import type { ScrambleOptions } from "./core/scramble-text";

type ScramblePreferences = Pick<Preferences.ScrambleSelectedText, "scrambleNumbers" | "seed">;

/** Engine options for the command's preferences. A blank seed means fresh words on every run. */
export function getScrambleOptions(preferences: ScramblePreferences): ScrambleOptions {
  return {
    scrambleNumbers: preferences.scrambleNumbers,
    seed: preferences.seed?.trim() || undefined,
  };
}
