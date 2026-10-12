# Publishing

There are two separate things to publish:

- **The Raycast Store** is what people install. Raycast reviews every update first.
- **GitHub releases** are a downloadable snapshot of the source, with checksums.

## Update the Raycast Store

1. Add an entry to the top of `CHANGELOG.md`:

   ```markdown
   ## [Short title] - {PR_MERGE_DATE}

   - What changed, in plain words.
   ```

   Type `{PR_MERGE_DATE}` exactly like that. Raycast swaps in the date when it publishes.

2. Run the checks:

   ```bash
   npm ci
   npm test
   npm run lint
   npm run build
   npm run check-core
   ```

3. On your Mac, run `npm run publish`. It asks you to sign in to GitHub in your browser, then opens a pull request in [raycast/extensions](https://github.com/raycast/extensions).
4. If it says someone else changed the extension there, run `npx @raycast/api@latest pull-contributions` first, check what came in, and commit it.
5. Raycast reviews the pull request. When they merge it, the update goes live in the Store.

The README is also the Store page, so keep it about using the extension. Developer notes belong in `CONTRIBUTING.md`.

## Publish a GitHub release

1. Make sure the top entry of `CHANGELOG.md` describes the release. It becomes the release notes.
2. On GitHub, open **Actions › Release › Run workflow**. Enter the version, such as `1.1.0`, leave **Dry run** ticked, and run it. When it's green, its summary lists the file, its checksum and the release notes.
3. Run it again on `main` with **Dry run** unticked. It tags the version (for example `v1.1.0`) and publishes the release with `Text-Scramble-Raycast-<version>.zip` and `SHA256SUMS.txt`.

The workflow refuses to publish a version that already has a release.
