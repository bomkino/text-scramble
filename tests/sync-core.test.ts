import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

// These tests never touch the network: they use --offline or --from with a throwaway local git repository.
const REPO = path.resolve(__dirname, "..");
const SCRIPT = path.join("scripts", "sync-core.mjs");

interface LockFile {
  repository: string;
  ref: string;
  commit: string;
  files: { source: string; path: string; sha256: string }[];
}

function run(root: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [path.join(root, SCRIPT), ...args], { cwd: root, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function readLock(root: string): LockFile {
  return JSON.parse(readFileSync(path.join(root, "core-sync.json"), "utf8"));
}

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

// A copy of this repository's sync script, lock and vendored files, so tests can break them safely.
function copyOfThisRepo(t: TestContext): string {
  const root = mkdtempSync(path.join(tmpdir(), "text-scramble-sync-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of [SCRIPT, "core-sync.json", ...readLock(REPO).files.map((entry) => entry.path)]) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    cpSync(path.join(REPO, file), path.join(root, file));
  }
  return root;
}

function git(cwd: string, ...args: string[]): string {
  const identity = ["-c", "user.name=Sync Test", "-c", "user.email=sync@example.com", "-c", "commit.gpgsign=false"];
  return execFileSync("git", [...identity, ...args], { cwd, encoding: "utf8", stdio: "pipe" }).trim();
}

// A tiny stand-in for the plugins repository: one commit on main with every source file the lock maps.
function fakePluginsRepo(t: TestContext, root: string): string {
  const upstream = mkdtempSync(path.join(tmpdir(), "text-scramble-plugins-"));
  t.after(() => rmSync(upstream, { recursive: true, force: true }));
  for (const { source } of readLock(root).files) {
    mkdirSync(path.dirname(path.join(upstream, source)), { recursive: true });
    const content = source.endsWith(".json") ? "[]\n" : `export const name = ${JSON.stringify(source)};\n`;
    writeFileSync(path.join(upstream, source), content);
  }
  git(upstream, "init", "--quiet", "--initial-branch=main");
  git(upstream, "add", ".");
  git(upstream, "commit", "--quiet", "-m", "Core v1");
  return upstream;
}

test("check-core --offline passes for the committed vendored core", () => {
  const result = run(REPO, "check", "--offline");

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Shared core matches bomkino\/text-scramble-design-plugins at [0-9a-f]{40}/);
});

test("core-sync.json pins a full commit and the SHA-256 of every vendored file", () => {
  const lock = readLock(REPO);

  assert.equal(lock.repository, "bomkino/text-scramble-design-plugins");
  assert.match(lock.commit, /^[0-9a-f]{40}$/);
  const mapping = lock.files.map(({ source, path: localPath }) => `${source} -> ${localPath}`);
  assert.ok(mapping.includes("packages/core/src/scramble-text.ts -> src/core/scramble-text.ts"));
  assert.ok(mapping.includes("packages/core/src/word-lists.ts -> src/core/word-lists.ts"));
  assert.ok(mapping.includes("packages/core/test-vectors.json -> tests/core-test-vectors.json"));
  for (const file of lock.files) {
    assert.equal(sha256(path.join(REPO, file.path)), file.sha256, file.path);
    if (file.path.endsWith(".ts")) assert.equal(file.path, file.source.replace(/^packages\/core\/src\//, "src/core/"));
  }
});

test("every module a vendored file imports is vendored too", () => {
  const lock = readLock(REPO);
  const vendored = new Set(lock.files.map((file) => file.path));

  for (const file of lock.files.filter((entry) => entry.path.endsWith(".ts"))) {
    const code = readFileSync(path.join(REPO, file.path), "utf8");
    for (const [, specifier] of code.matchAll(/\bfrom\s*["'](\.\.?\/[^"']+)["']/g)) {
      const imported = `${path.posix.join(path.posix.dirname(file.path), specifier)}.ts`;
      assert.ok(vendored.has(imported), `${file.path} imports ${specifier}, which core-sync.json does not map`);
    }
  }
});

test("check-core --offline fails when a vendored file is edited", (t) => {
  const root = copyOfThisRepo(t);
  appendFileSync(path.join(root, "src/core/word-lists.ts"), "// a local edit\n");

  const result = run(root, "check", "--offline");

  assert.equal(result.status, 1);
  assert.match(result.output, /src\/core\/word-lists\.ts: SHA-256 differs from core-sync\.json/);
  assert.match(result.output, /run npm run sync-core -- <ref>/);
  assert.match(result.output, new RegExp(`npm run sync-core -- ${readLock(root).commit}`));
});

test("check-core --offline fails when a vendored file is missing", (t) => {
  const root = copyOfThisRepo(t);
  unlinkSync(path.join(root, "tests/core-test-vectors.json"));

  const result = run(root, "check", "--offline");

  assert.equal(result.status, 1);
  assert.match(result.output, /tests\/core-test-vectors\.json: missing/);
});

test("check-core fails when core-sync.json is missing or does not pin a full SHA", (t) => {
  const root = copyOfThisRepo(t);
  const lock = readLock(root);
  writeFileSync(path.join(root, "core-sync.json"), JSON.stringify({ ...lock, commit: lock.commit.slice(0, 7) }));

  assert.equal(run(root, "check", "--offline").status, 1);
  assert.match(run(root, "check", "--offline").output, /full 40-character SHA/);

  unlinkSync(path.join(root, "core-sync.json"));
  assert.equal(run(root, "check", "--offline").status, 1);
  assert.match(run(root, "check", "--offline").output, /core-sync\.json is missing/);
});

test("sync-core --from vendors a local commit byte for byte and records it", (t) => {
  const root = copyOfThisRepo(t);
  const upstream = fakePluginsRepo(t, root);
  const head = git(upstream, "rev-parse", "HEAD");

  const result = run(root, "sync", "main", "--from", upstream);

  assert.equal(result.status, 0, result.output);
  const lock = readLock(root);
  assert.equal(lock.commit, head);
  assert.equal(lock.ref, "main");
  for (const file of lock.files) {
    assert.deepEqual(readFileSync(path.join(root, file.path)), readFileSync(path.join(upstream, file.source)));
    assert.equal(sha256(path.join(root, file.path)), file.sha256);
  }
  assert.equal(run(root, "check", "--from", upstream).status, 0);
  assert.equal(run(root, "check", "--offline").status, 0);
});

test("check-core --from fails when the vendored copy differs from the pinned commit", (t) => {
  const root = copyOfThisRepo(t);
  const upstream = fakePluginsRepo(t, root);
  assert.equal(run(root, "sync", "main", "--from", upstream).status, 0);

  // Edit a vendored file and its recorded hash together: only the comparison with upstream can catch it.
  const lock = readLock(root);
  writeFileSync(path.join(root, "src/core/scramble-text.ts"), 'export const name = "edited here";\n');
  const entry = lock.files.find((file) => file.path === "src/core/scramble-text.ts");
  assert.ok(entry);
  entry.sha256 = sha256(path.join(root, "src/core/scramble-text.ts"));
  writeFileSync(path.join(root, "core-sync.json"), JSON.stringify(lock, null, 2));

  assert.equal(run(root, "check", "--offline").status, 0);
  const result = run(root, "check", "--from", upstream);
  assert.equal(result.status, 1);
  assert.match(result.output, /src\/core\/scramble-text\.ts: differs from packages\/core\/src\/scramble-text\.ts/);
});

test("sync-core fails loudly and writes nothing for an unknown ref", (t) => {
  const root = copyOfThisRepo(t);
  const upstream = fakePluginsRepo(t, root);
  const before = readFileSync(path.join(root, "core-sync.json"), "utf8");

  const result = run(root, "sync", "no-such-branch", "--from", upstream);

  assert.equal(result.status, 1);
  assert.match(result.output, /"no-such-branch" is not a commit/);
  assert.equal(readFileSync(path.join(root, "core-sync.json"), "utf8"), before);
});

test("sync-core re-pins to a newer commit in one command", (t) => {
  const root = copyOfThisRepo(t);
  const upstream = fakePluginsRepo(t, root);
  assert.equal(run(root, "sync", "main", "--from", upstream).status, 0);

  writeFileSync(path.join(upstream, "packages/core/src/scramble-text.ts"), 'export const name = "v2";\n');
  git(upstream, "commit", "--quiet", "-am", "Core v2");
  assert.equal(run(root, "check", "--from", upstream).status, 0, "the old pin still matches its own commit");

  const result = run(root, "sync", "main", "--from", upstream);

  assert.equal(result.status, 0, result.output);
  assert.equal(readLock(root).commit, git(upstream, "rev-parse", "HEAD"));
  assert.equal(readFileSync(path.join(root, "src/core/scramble-text.ts"), "utf8"), 'export const name = "v2";\n');
});

test("sync-core vendors modules the core gained and adds them to the mapping", (t) => {
  const root = copyOfThisRepo(t);
  const upstream = fakePluginsRepo(t, root);
  const core = path.join(upstream, "packages/core/src");
  writeFileSync(path.join(core, "scramble-text.ts"), 'import { domains } from "./new-module";\nexport { domains };\n');
  writeFileSync(path.join(core, "new-module.ts"), 'export { domains } from "./new-data";\n');
  writeFileSync(path.join(core, "new-data.ts"), 'export const domains = ["invalid"];\n');
  git(upstream, "add", ".");
  git(upstream, "commit", "--quiet", "-m", "Core gains two modules");

  const result = run(root, "sync", "main", "--from", upstream);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /added {5}src\/core\/new-module\.ts \(imported by src\/core\/scramble-text\.ts\)/);
  assert.match(result.output, /added {5}src\/core\/new-data\.ts \(imported by src\/core\/new-module\.ts\)/);
  const lock = readLock(root);
  for (const name of ["new-module.ts", "new-data.ts"]) {
    const entry = lock.files.find((file) => file.path === `src/core/${name}`);
    assert.equal(entry?.source, `packages/core/src/${name}`);
    assert.deepEqual(readFileSync(path.join(root, "src/core", name)), readFileSync(path.join(core, name)));
    assert.equal(entry?.sha256, sha256(path.join(root, "src/core", name)));
  }
  assert.equal(run(root, "check", "--from", upstream).status, 0);
});
