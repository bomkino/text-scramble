# Text Scramble — Design Notes

## Goal

Create presentation-safe draft copy that hides original wording without damaging layout or looking like default filler.

## Where the engine lives

The engine in `src/core/` is an exact copy of `packages/core` in [bomkino/text-scramble-design-plugins](https://github.com/bomkino/text-scramble-design-plugins), which the Figma and InDesign plugins use too. Change it there, never here. See [CONTRIBUTING.md](../CONTRIBUTING.md#the-shared-engine).

## Scrambling model

1. Keep every character that isn't a letter or a number exactly where it is: spaces, tabs, punctuation, emoji, paragraph breaks, and manual line breaks. The one exception is the last dot of some web addresses (rule 9).
2. Keep one output character for every input character, and the same uppercase and lowercase pattern.
3. Generate many pronounceable invented candidates from restrained vowel, consonant, and consonant-cluster rules. Candidates use plain Latin letters, whatever the source alphabet.
4. Score candidates against a font-agnostic glyph-width model (a rough width for each letter). Pick the closest visual shape, with extra weight on total word width. Scoring is done in lowercase, so capitals don't change which word wins.
5. Reject the source word itself, real words from the shared word list (`src/core/word-lists.ts`), unwelcome fragments, three vowels or three consonants in a row, and a letter pair repeated back to back.
6. **Accents follow one rule.** An accented letter becomes an invented letter with the same accent only when that pair is a common accented letter most fonts draw: Latin-1, Latin Extended-A, Romanian comma-below letters, and Vietnamese. Scoring strongly prefers candidates whose letters can carry the source's accents. When none can, the accent is dropped rather than adding a character. An accent stored as a separate mark stays a separate mark. "é" typed as one character and "e" plus a combining accent count as the same word.
7. **Shared word cache.** The scrambler remembers each invented word, so a repeated word gets the same invented word every time. The cache ignores case and treats both accent spellings as one word; a different accent makes a different word. In Raycast the cache lasts for one selection. The plugins share it across every text in one run.
8. **Seed.** Without a seed, every run is random. With a seed, each word and number draws from its own random stream, made from the seed and the word, so with the same seed a word becomes the same invented word in every text and every run. Raycast trims spaces around the Seed preference and treats a blank one as no seed. The shared test vectors in `tests/core-test-vectors.json` check that this repo gives exactly the same output as the plugins.
9. **Web-address safety.** Emails, web addresses, and bare domains that end in a real top-level domain (the IANA list in `src/core/top-level-domains.ts`) are found first. Schemes such as `https://` and `mailto:` stay, and so does `www`. A domain that is already safe, such as `example.com` or anything ending in `.test` or `.invalid`, stays whole (the name before an `@` is still scrambled). Otherwise its names are scrambled and its ending becomes a reserved ending of the same length that can't be registered: `.xx`, `.alt`, `.test`, `.local`, `.example`, `.internal`, or `.localhost`. When no reserved ending has the right length, a shorter one is used and filler letters are added to the end of the name, so the address keeps its total length but its last dot can move.
10. Scramble every decimal digit by default to a different digit, keeping its writing system, the digit count, and separators. Leave non-decimal number symbols, such as ½ or Ⅷ, untouched.

## Acceptance criteria

- Output is plain text.
- Original whitespace, punctuation, line breaks, character counts, and case patterns are preserved.
- Repeated words stay visually consistent inside one selection.
- The same seed and the same text always give the same output, matching the shared test vectors.
- Sample deck lines remain within 5.5% of estimated source width.
- No network request, AI service, telemetry, or text storage.
- Default action replaces current selection; clipboard-only mode remains available.

## Deliberate limit

Manual line breaks are exact. Automatic wrapping can only be close, never pixel-perfect: font, tracking, kerning, OpenType features, and application shaping all affect final measure. Word length plus width scoring gives strong practical fidelity without requiring access to Figma or InDesign typography internals.
