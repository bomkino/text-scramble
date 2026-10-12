// Keeps the vendored scrambling engine byte-identical to bomkino/text-scramble-design-plugins, which is the
// single source of truth for it. Change the engine there, then re-pin it here.
//
//   npm run sync-core -- <ref> [--from <plugins checkout>]
//     Resolves a branch, tag or commit to a full SHA, writes the vendored files and core-sync.json.
//   npm run check-core [-- --offline] [-- --from <plugins checkout>]
//     Fails if a vendored file no longer matches core-sync.json or, unless --offline, the pinned commit.
//
// Without --from, files come from GitHub over HTTPS (no token needed). With --from, they come from a local
// checkout of the plugins repo through git, which must already have the commit (git fetch it first).
// The file mapping lives in core-sync.json. sync-core also follows the relative imports of vendored modules,
// so when the core gains a module, re-pinning vendors it and adds it to the mapping with no other step.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCK_FILE = "core-sync.json";
const LOCK_NOTE =
  "Written by `npm run sync-core`. Do not edit the vendored files; change them in the source repository.";
const DEFAULT_REPOSITORY = "bomkino/text-scramble-design-plugins";
const DEFAULT_FILES = [
  { source: "packages/core/src/scramble-text.ts", path: "src/core/scramble-text.ts" },
  { source: "packages/core/src/word-lists.ts", path: "src/core/word-lists.ts" },
  { source: "packages/core/test-vectors.json", path: "tests/core-test-vectors.json" },
];
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/;
const MODULE_PATTERN = /\.(?:[cm]?[jt]s|tsx)$/;
const RELATIVE_IMPORT_PATTERN = /\bfrom\s*["'](\.\.?\/[^"']+)["']|\bimport\s*\(?\s*["'](\.\.?\/[^"']+)["']/g;
const REQUEST_TIMEOUT_MS = 30_000;

class SyncError extends Error {}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertSafeRelativePath(file, label) {
  const normalized = typeof file === "string" && file ? path.posix.normalize(file) : "..";
  if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    throw new SyncError(`${LOCK_FILE}: ${label} "${file}" must be a relative path inside the repository.`);
  }
}

async function readLock({ required }) {
  let text;
  try {
    text = await readFile(path.join(ROOT, LOCK_FILE), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (required) throw new SyncError(`${LOCK_FILE} is missing. Run: npm run sync-core -- <branch, tag or commit>`);
    return { repository: DEFAULT_REPOSITORY, files: DEFAULT_FILES };
  }

  let lock;
  try {
    lock = JSON.parse(text);
  } catch (error) {
    throw new SyncError(`${LOCK_FILE} is not valid JSON (${error.message}).`);
  }
  if (typeof lock.repository !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(lock.repository)) {
    throw new SyncError(`${LOCK_FILE}: "repository" must look like "owner/name".`);
  }
  if (!Array.isArray(lock.files) || lock.files.length === 0) {
    throw new SyncError(`${LOCK_FILE}: "files" must list at least one { source, path } mapping.`);
  }
  for (const file of lock.files) {
    assertSafeRelativePath(file.source, "source");
    assertSafeRelativePath(file.path, "path");
  }
  return lock;
}

function git(checkout, args) {
  return execFileSync("git", ["-C", checkout, ...args], {
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function localSource(checkout) {
  try {
    git(checkout, ["rev-parse", "--git-dir"]);
  } catch {
    throw new SyncError(`--from ${checkout} is not a git checkout of the plugins repository.`);
  }

  return {
    label: checkout,
    async resolve(ref) {
      let sha;
      try {
        sha = git(checkout, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])
          .toString()
          .trim();
      } catch {
        throw new SyncError(`"${ref}" is not a commit in ${checkout}. Fetch it first: git -C ${checkout} fetch origin`);
      }
      try {
        const remote = git(checkout, ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${ref}^{commit}`]);
        const remoteSha = remote.toString().trim();
        if (remoteSha && remoteSha !== sha) {
          console.warn(`Note: local "${ref}" is ${sha.slice(0, 7)} but origin/${ref} is ${remoteSha.slice(0, 7)}.`);
          console.warn(`      Pass origin/${ref} to vendor the remote branch instead.`);
        }
      } catch {
        // Not a branch with a remote counterpart; nothing to compare.
      }
      return sha;
    },
    async read(sha, file) {
      try {
        return git(checkout, ["show", `${sha}:${file}`]);
      } catch {
        throw new SyncError(
          `Cannot read ${file} at ${sha} in ${checkout}. ` +
            `If the commit is missing there, fetch it first: git -C ${checkout} fetch origin`,
        );
      }
    },
  };
}

async function request(url, accept) {
  let response;
  try {
    response = await fetch(url, {
      headers: { accept, "user-agent": "text-scramble-sync-core" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error.cause?.code ?? error.cause?.message ?? error.message;
    throw new SyncError(
      `Could not reach ${url} (${reason}).\n` +
        "Behind a proxy, run with NODE_USE_ENV_PROXY=1 (Node 22.21 or newer). " +
        "Or pass --from <path to a plugins checkout>, or --offline to check-core to compare hashes only.",
    );
  }

  if (response.status !== 200) {
    let detail = "";
    try {
      const body = await response.text();
      detail = JSON.parse(body).message ?? "";
    } catch {
      // The body is not JSON; the status says enough.
    }
    const hint =
      response.status === 403 || response.status === 429
        ? "\nGitHub allows 60 unauthenticated API requests an hour per address. Retry later, or pass --from <path>."
        : "";
    throw new SyncError(
      `GET ${url} returned ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}${hint}`,
    );
  }
  return response;
}

function githubSource(repository) {
  return {
    label: `github.com/${repository}`,
    async resolve(ref) {
      const url = `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(ref)}`;
      const commit = await (await request(url, "application/vnd.github+json")).json();
      if (!FULL_SHA_PATTERN.test(commit.sha ?? "")) throw new SyncError(`GET ${url} returned no commit SHA.`);
      return commit.sha;
    },
    async read(sha, file) {
      const filePath = file.split("/").map(encodeURIComponent).join("/");
      const url = `https://raw.githubusercontent.com/${repository}/${sha}/${filePath}`;
      return Buffer.from(await (await request(url, "*/*")).arrayBuffer());
    },
  };
}

function sourceFor(options, repository) {
  if (options.from === undefined) return githubSource(repository);
  const base = process.env.INIT_CWD ?? process.cwd();
  return localSource(path.resolve(base, options.from));
}

// The relative modules a vendored source file imports, as paths next to it ("./web-addresses" → ".ts").
function relativeImports(file) {
  if (!MODULE_PATTERN.test(file.source)) return [];
  const specifiers = new Set();
  for (const match of file.bytes.toString("utf8").matchAll(RELATIVE_IMPORT_PATTERN)) {
    specifiers.add(match[1] ?? match[2]);
  }
  const modulePath = (base, specifier) => {
    const joined = path.posix.join(path.posix.dirname(base), specifier);
    if (joined.endsWith(".js")) return `${joined.slice(0, -3)}.ts`;
    return MODULE_PATTERN.test(joined) ? joined : `${joined}.ts`;
  };
  return [...specifiers].map((specifier) => ({
    source: modulePath(file.source, specifier),
    path: modulePath(file.path, specifier),
  }));
}

async function readLocal(file) {
  try {
    return await readFile(path.join(ROOT, file));
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function sync(ref, options) {
  if (!ref || ref.startsWith("-") || /\s/.test(ref)) throw new SyncError(USAGE);

  const lock = await readLock({ required: false });
  const source = sourceFor(options, lock.repository);
  const commit = await source.resolve(ref);

  // Read everything before writing anything, so a failed download never leaves a half-synced copy.
  const downloads = [];
  for (const file of lock.files) {
    downloads.push({ source: file.source, path: file.path, bytes: await source.read(commit, file.source) });
  }

  // Vendor every module the vendored files import, including ones the core gained since the last pin.
  const known = new Set(downloads.map((file) => file.source));
  for (let index = 0; index < downloads.length; index++) {
    for (const module of relativeImports(downloads[index])) {
      if (known.has(module.source)) continue;
      assertSafeRelativePath(module.source, "source");
      assertSafeRelativePath(module.path, "path");
      known.add(module.source);
      downloads.push({ ...module, bytes: await source.read(commit, module.source), importedBy: downloads[index].path });
    }
  }

  const files = [];
  for (const { source: sourcePath, path: localPath, bytes, importedBy } of downloads) {
    const previous = await readLocal(localPath);
    await mkdir(path.dirname(path.join(ROOT, localPath)), { recursive: true });
    await writeFile(path.join(ROOT, localPath), bytes);
    files.push({ source: sourcePath, path: localPath, sha256: sha256(bytes) });
    const status = importedBy ? "added    " : previous?.equals(bytes) ? "unchanged" : "updated  ";
    console.log(`${status} ${localPath}${importedBy ? ` (imported by ${importedBy})` : ""}`);
  }

  const nextLock = { note: LOCK_NOTE, repository: lock.repository, ref, commit, files };
  await writeFile(path.join(ROOT, LOCK_FILE), `${JSON.stringify(nextLock, null, 2)}\n`);
  console.log(`Pinned ${lock.repository} at ${commit} (${ref}) from ${source.label}.`);
}

async function check(options) {
  const lock = await readLock({ required: true });
  if (!FULL_SHA_PATTERN.test(lock.commit ?? "")) {
    throw new SyncError(`${LOCK_FILE}: "commit" must be a full 40-character SHA. Run: npm run sync-core -- <ref>`);
  }

  const problems = [];
  const localFiles = [];
  for (const file of lock.files) {
    const bytes = await readLocal(file.path);
    localFiles.push(bytes);
    if (bytes === undefined) problems.push(`${file.path}: missing`);
    else if (sha256(bytes) !== file.sha256) problems.push(`${file.path}: SHA-256 differs from ${LOCK_FILE}`);
  }

  let checkedAgainst = "hashes only";
  if (!options.offline) {
    const source = sourceFor(options, lock.repository);
    checkedAgainst = source.label;
    for (const [index, file] of lock.files.entries()) {
      const upstream = await source.read(lock.commit, file.source);
      if (localFiles[index] !== undefined && !upstream.equals(localFiles[index])) {
        problems.push(`${file.path}: differs from ${file.source} at ${lock.commit.slice(0, 7)}`);
      }
    }
  }

  if (problems.length > 0) {
    console.error(`The vendored shared core no longer matches ${lock.repository} at ${lock.commit}:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error("");
    console.error(`Do not edit these files here; change the engine in ${lock.repository}. Then re-vendor it:`);
    console.error("  run npm run sync-core -- <ref>   (a branch, tag or commit of the plugins repo)");
    console.error("To restore the pinned version exactly:");
    console.error(`  npm run sync-core -- ${lock.commit}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Shared core matches ${lock.repository} at ${lock.commit} (${lock.files.length} files, ${checkedAgainst}).`,
  );
}

const USAGE =
  "Usage:\n  npm run sync-core -- <ref> [--from <plugins checkout>]\n" +
  "  npm run check-core [-- --offline] [-- --from <plugins checkout>]";

async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: { from: { type: "string" }, offline: { type: "boolean", default: false } },
    });
  } catch (error) {
    throw new SyncError(`${error.message}\n${USAGE}`);
  }
  const { positionals, values } = parsed;
  const [command, ref, ...extra] = positionals;

  if (command === "sync" && extra.length === 0 && !values.offline) return sync(ref, values);
  if (command === "check" && ref === undefined) return check(values);
  throw new SyncError(USAGE);
}

main().catch((error) => {
  console.error(error instanceof SyncError ? error.message : error);
  process.exitCode = 1;
});
