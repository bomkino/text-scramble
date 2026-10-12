# Text Scramble

**A humane alternative to Lorem Ipsum for decks, design drafts, and work in progress.**

Text Scramble swaps the words you select for invented words that keep the same shape. Spaces, punctuation, paragraph breaks, line breaks, word lengths, and capitals stay where they were, and each invented word is picked to be about as wide as the word it replaces.

## Use

1. In Figma, InDesign, Keynote, or another app, start editing the text and select the characters you want to scramble.
2. Open Raycast and run **Scramble Selected Text**.
3. The selection is replaced with scrambled plain text.

To do it in one keystroke, give the command a hotkey in **Raycast Settings › Extensions › Text Scramble**.

If Raycast can't read your selection or paste into it, allow Raycast under **System Settings › Privacy & Security › Accessibility**.

## What stays the same

- Spaces, tabs, punctuation, paragraphs, and line breaks
- The length of every word and number
- Capital letters, in the same places
- The kind of digits, such as fullwidth, Arabic-Indic, or Devanagari
- Accents, wherever the invented letter has a common accented form, such as á or ñ
- Roughly the same width for each word and line
- Repeated words: a word used twice in one selection gets the same invented word both times

## What changes

- Every word becomes an invented, pronounceable word of the same length. Invented words avoid common English words and unwelcome fragments.
- Words in other alphabets, such as Greek or Cyrillic, become invented words in Latin letters.
- Every digit becomes a different digit, unless you turn off **Scramble Numbers**.
- Emails and web addresses keep their total length, though the parts inside can shift a little. `https://`, `mailto:`, and `www.` stay. The ending always becomes a reserved one, such as `.test` or `.example`, that no real website or mailbox can use.

Lines that wrap on their own can still move a little, because fonts, letter spacing, and kerning differ.

## Preferences

| Preference       | Default           | What it does                                                                         |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------ |
| Preferred Source | Selected Text     | Where to read the text from: Selected Text or Clipboard                              |
| Output Action    | Replace Selection | Replace Selection, or Copy to Clipboard to copy the result as plain text instead     |
| Scramble Numbers | On                | On changes every digit. Off leaves numbers as they are                               |
| Seed             | Empty             | Optional. With the same seed, the same text always gives the same result (see below) |

**Preferred Source:** Text Scramble reads this source first. It only tries the other one when this one is empty. If it can't read this source at all, it stops and tells you, instead of using the other one.

**Replace Selection** pastes the scrambled text, then puts your clipboard back. It can put back plain text and HTML (the formatted text you get when you copy from a web page). Other kinds of content copied along with them may not come back. If the clipboard holds a copied file, or nothing Raycast can read as text, Text Scramble stops before changing your selection or your clipboard, and asks you to save what's on the clipboard first. If macOS won't let it put the clipboard back after a few tries, your text is still replaced, and Text Scramble tells you to get your earlier clipboard back from Raycast's Clipboard History.

**Seed:** a seed is any word or number you choose. With the same seed, the same text always turns into the same scrambled text, so you can scramble a slide again and get the same words. Leave it empty to get new words every time.

## Privacy

Everything runs on your Mac. Text Scramble sends nothing anywhere and keeps no copy of your text.
It disguises drafts; it isn't redaction. Word lengths, punctuation, and repeated words stay visible, so go through the [privacy checklist](https://github.com/bomkino/text-scramble/blob/main/PRIVACY.md) before you share a scrambled file.

## Credits

Text Scramble’s selected-text and clipboard fallback, plus its paste-or-copy interaction model, was inspired by Eric (`erics118`) and the contributors to Raycast’s open-source [Change Case](https://www.raycast.com/erics118/change-case) extension.

No Change Case source code is bundled or copied. The MIT-licensed interaction pattern was studied and then implemented for Text Scramble’s distinct purpose.

Built on the [Raycast API](https://developers.raycast.com/) and its open extension ecosystem. Designed and maintained by [pitch.dog](https://pitch.dog/), with development support from OpenAI Codex.

Source code, the contributor guide, and the MIT License are on [GitHub](https://github.com/bomkino/text-scramble).
