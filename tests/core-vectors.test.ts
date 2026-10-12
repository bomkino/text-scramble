import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { scrambleText, scrambleTexts, type ScrambleOptions } from "../src/core/scramble-text";
import { getScrambleOptions } from "../src/scramble-options";

interface TestVector {
  inputs: string[];
  options: ScrambleOptions;
  outputs: string[];
}

// Vendored byte-for-byte from the plugins repo by `npm run sync-core`. The Figma and InDesign plugins run
// the same vectors, so passing here means the same seed gives the same output in every app.
const vectors: TestVector[] = JSON.parse(readFileSync(path.join(__dirname, "core-test-vectors.json"), "utf8"));

// The invented sample from the Mac test brief. The second "Amélie" stores its accent as a separate mark.
const SAMPLE = [
  "Brindlewick Studio — Spring Review 2026",
  "Quellmoor Orchard will open its café on 14 March, with 3 new rooms.",
  "Amélie and Jonas wrote the brief; Ame\u0301lie signs it off.",
].join("\n");

test("reproduces every shared test vector from the plugins repo exactly", () => {
  assert.ok(vectors.length >= 10);
  vectors.forEach(({ inputs, options, outputs }, index) => {
    assert.deepEqual(scrambleTexts(inputs, options), outputs, `Vector ${index} (seed ${JSON.stringify(options.seed)})`);
  });
});

test("the Seed preference gives identical output on every run", () => {
  const preferences = { scrambleNumbers: true, seed: "  studio 7 " };
  const first = scrambleText(SAMPLE, getScrambleOptions(preferences));
  const second = scrambleText(SAMPLE, getScrambleOptions(preferences));

  assert.equal(first, second);
  assert.notEqual(first, SAMPLE);
  assert.equal(first, scrambleText(SAMPLE, { scrambleNumbers: true, seed: "studio 7" }));
});

test("a different Seed gives different output", () => {
  const one = scrambleText(SAMPLE, getScrambleOptions({ scrambleNumbers: true, seed: "one" }));
  const two = scrambleText(SAMPLE, getScrambleOptions({ scrambleNumbers: true, seed: "two" }));

  assert.notEqual(one, two);
});

test("an empty or blank Seed means fresh words each run", () => {
  assert.equal(getScrambleOptions({ scrambleNumbers: true, seed: "" }).seed, undefined);
  assert.equal(getScrambleOptions({ scrambleNumbers: true, seed: " \t " }).seed, undefined);

  const runs = new Set(
    Array.from({ length: 5 }, () => scrambleText(SAMPLE, getScrambleOptions({ scrambleNumbers: true, seed: "" }))),
  );
  assert.ok(runs.size > 1);
});

test("the Scramble Numbers preference still applies with a Seed", () => {
  const options = getScrambleOptions({ scrambleNumbers: false, seed: "studio" });
  const result = scrambleText(SAMPLE, options);

  assert.equal(options.scrambleNumbers, false);
  assert.deepEqual(result.match(/\d+/g), ["2026", "14", "3"]);
  assert.notEqual(result, SAMPLE);
});

test("both stored spellings of an accented name become the same invented word, accent kept", () => {
  for (const seed of ["studio", "spring", "1", "2", "3"]) {
    const lastLine = scrambleText(SAMPLE, getScrambleOptions({ scrambleNumbers: true, seed })).split("\n")[2];
    const words = lastLine.split(/[ ;.]+/);

    assert.equal(words[0].normalize("NFC"), words[6].normalize("NFC"), `seed ${seed}`);
    assert.equal(Array.from(words[0]).length, Array.from("Amélie").length);
    assert.equal(Array.from(words[6]).length, Array.from("Ame\u0301lie").length);
    assert.match(words[0].normalize("NFD"), /^\p{Lu}\p{Ll}\p{Ll}\u0301\p{Ll}\p{Ll}\p{Ll}$/u, `seed ${seed}`);
  }
});
