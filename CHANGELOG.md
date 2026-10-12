# Changelog

## [Seed option and safer placeholder text] - {PR_MERGE_DATE}

- Added a **Seed** preference. With the same seed, the same text always scrambles to the same result. Leave it empty for new words every time.
- Emails and web addresses now always end in a reserved ending, such as `.test`, `.example`, or `.alt`, so a scrambled address can't lead to a real website or mailbox. Each address keeps its length, and `https://`, `mailto:`, and `www.` stay as they are.
- Accented words now keep exactly the same number of characters, and use common accented letters that most fonts include, such as á or ñ.
- A sentence missing a space after its full stop ("the end.Next week") is no longer mistaken for a web address, so words like "Test" or "Alt" no longer turn up in scrambled text.
- Now uses the same scrambling engine as Text Scramble for Figma and InDesign. Its shared list of real words to keep out of the invented text has about 200 more words.

## [Initial Release] - 2026-08-13

- Added shape-matched, pronounceable invented-word scrambling.
- Preserved whitespace, punctuation, token length, casing, and line breaks.
- Added selected-text and clipboard source priority with safe fallback behavior.
- Added replace-selection and copy-only output.
- Preserved the writing system and visual footprint of Unicode decimal digits.
- Added optional numeral preservation and clear no-op feedback.
- Preserved existing clipboard contents after replacing selected text.
- Protected unsupported rich clipboard items by stopping before an unsafe paste.
- Protected file-bearing clipboards whose text representation cannot be restored losslessly.
- Retried transient clipboard restoration failures and reported persistent failures with a recovery path.
- Stopped safely when clipboard access fails instead of acting on a different source.
- Preserved Unicode titlecase letters as uppercase-shaped invented copy.
- Kept composed and decomposed accented words consistent without cache-length mismatches.
- Kept all processing private and on-device.
