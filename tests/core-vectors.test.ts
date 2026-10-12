import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { scrambleTexts, type ScrambleOptions } from "../src/core/scramble-text";

interface TestVector {
  inputs: string[];
  options: ScrambleOptions;
  outputs: string[];
}

// Vendored byte-for-byte from the plugins repo by `npm run sync-core`. The Figma and InDesign plugins run
// the same vectors, so passing here means the same seed gives the same output in every app.
const vectors: TestVector[] = JSON.parse(readFileSync(path.join(__dirname, "core-test-vectors.json"), "utf8"));

test("reproduces every shared test vector from the plugins repo exactly", () => {
  assert.ok(vectors.length >= 10);
  vectors.forEach(({ inputs, options, outputs }, index) => {
    assert.deepEqual(scrambleTexts(inputs, options), outputs, `Vector ${index} (seed ${JSON.stringify(options.seed)})`);
  });
});
