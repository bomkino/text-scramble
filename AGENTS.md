# Agent guidance

This is the Text Scramble extension for Raycast: TypeScript, built with the Raycast CLI (`ray`) through npm scripts. Read `CONTRIBUTING.md` for setup and `docs/PUBLISHING.md` for releases.

## Rules

- Keep secrets out of Git. Use environment variables and document required names in `.env.example` when needed. Do not commit provider credentials, deployment tokens, or generated deployment state.
- The repository is public. Use invented sample text only, such as "Brindlewick Studio". Never add client names, client copy, real people's names, or private file paths.
- Never edit `src/core/` or `tests/core-test-vectors.json` by hand. They are copies of `packages/core` in `bomkino/text-scramble-design-plugins`, pinned in `core-sync.json`. Change the engine there first, then run `npm run sync-core -- <branch, tag or commit>` here and commit the result with `core-sync.json`. `npm run check-core` and CI fail on any drift.
- `README.md` is the Raycast Store page. Keep it about using the extension, and use full `https://` URLs for every link. Developer notes belong in `CONTRIBUTING.md`.
- Add an entry to the top of `CHANGELOG.md` for user-visible changes, titled `## [Title] - {PR_MERGE_DATE}`.
- Prefer small, reviewable changes. Preserve existing project structure and scripts.

## Checks

Use Node.js 22.22.2 or newer. Run all of these before handoff:

```bash
npm ci
npm test
npm run lint
npm run build
npm run check-core
```

`npm run lint` covers `package.json`, the icon, and `src/` only. Format changed Markdown with `npx prettier --write <file>`.
