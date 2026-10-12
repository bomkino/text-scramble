# Contributing

[![CI](https://github.com/bomkino/text-scramble/actions/workflows/ci.yml/badge.svg)](https://github.com/bomkino/text-scramble/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-111111.svg)](LICENSE)

Small, focused contributions are welcome. This guide is for changing the code. To use Text Scramble, install it from the [Raycast Store](https://www.raycast.com/kumail_changezi/text-scramble).

## What you need

- A Mac with [Raycast](https://www.raycast.com/), to try the extension. The checks below also run on Linux.
- Node.js 22.22.2 or newer. Node.js runs the project's tools. The Raycast API package needs at least this version, and CI (the checks GitHub runs on every change) uses it. To see your version, run `node --version`.

## Install

```bash
git clone https://github.com/bomkino/text-scramble.git
cd text-scramble
npm ci
npm run dev
```

`npm ci` installs the exact tool versions listed in `package-lock.json`. `npm run dev` loads the extension into Raycast as a development copy and rebuilds it when you save a file. After the first run, the command stays in Raycast. If selection or paste is blocked, allow Raycast under **System Settings › Privacy & Security › Accessibility**.

If you already have the folder, run `npm ci` and `npm run dev` there to load the latest version.

## Checks

Run these before you open a pull request:

```bash
npm ci
npm test
npm run lint
npm run build
npm run check-core
```

- `npm test` runs the automated tests.
- `npm run lint` checks `package.json`, the icon, and the code style and formatting of `src/`. `npm run fix-lint` fixes most of what it finds. It doesn't check Markdown files, so format the ones you change with Prettier, for example `npx prettier --write README.md`.
- `npm run build` checks that the extension builds.
- `npm run check-core` checks that the shared engine is an exact copy (see below).

CI runs the same checks on every pull request and every push to `main`.

To try a real paste, open [tests/manual-smoke-test-source.txt](tests/manual-smoke-test-source.txt), select all, then run **Scramble Selected Text**. The three lines should keep their shape while the words and numbers change.

## The shared engine

The scrambling engine is shared with Text Scramble for Figma and InDesign. Its master copy is `packages/core` in [bomkino/text-scramble-design-plugins](https://github.com/bomkino/text-scramble-design-plugins). Here, `src/core/` and `tests/core-test-vectors.json` are exact copies of it, pinned to one commit of that repo in `core-sync.json`. Never edit them by hand.

To change the engine:

1. Make the change in the plugins repo first, with a test, and merge it there.
2. Here, copy it in. Use `main`, or any branch, tag, or commit of the plugins repo:

   ```bash
   npm run sync-core -- main
   ```

   This downloads the engine files from GitHub at that commit and records the commit and a fingerprint (SHA-256 hash) of each file in `core-sync.json`. If the engine imports a new file, that file is copied too.

3. Run the checks, then commit the changed files together with `core-sync.json`.

To copy from a plugins folder on your computer instead, add `--from` and the folder's path. It reads committed files only, so commit there first:

```bash
npm run sync-core -- main --from ../text-scramble-design-plugins
```

`npm run check-core` is the drift check. It fails if a copied file was changed here, or if it no longer matches the pinned commit on GitHub. CI runs it on every pull request. If it fails, undo your edits to those files, or run the `npm run sync-core -- <commit>` line it prints to restore the pinned copy. Without internet, `npm run check-core -- --offline` compares against the fingerprints only.

## Guidelines

- Keep the output quiet, readable, and free of real words, and keep every rule the tests check, such as the same spacing, punctuation, and word lengths.
- Add a focused test for any behavior change in this repo. Engine changes and their tests belong in the plugins repo.
- Text must stay on the device: no network requests at run time.
- Use invented sample text in tests and docs, such as "Brindlewick Studio", never real client copy or names.

Publishing to the Raycast Store and making GitHub releases are covered in [docs/PUBLISHING.md](docs/PUBLISHING.md).
