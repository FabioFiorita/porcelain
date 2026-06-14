---
name: releasing
description: How to cut a Porcelain release — bump/tag, the GitHub Actions release pipeline, signing & notarization secrets, changelog generation, and the draft-then-publish flow for electron-updater. Read when publishing a new version, debugging the release workflow, or changing signing/notarization. The chronology behind these choices lives in the `history` skill.
---

# Porcelain — releasing

Cutting a release publishes a **signed + notarized** macOS build to GitHub Releases
for `electron-updater`.

## Runbook

1. Land your changes on `main` and confirm CI is green (`.github/workflows/ci.yml`
   runs on every push to `main` + PRs: install → lint → typecheck → test → build on
   Ubuntu).
2. **Bump and tag in one step:** `pnpm version <patch|minor|major>` — updates
   `package.json`, regenerates `CHANGELOG.md` from the conventional commits (the
   `version` lifecycle hook → `pnpm changelog`, staged into the release commit),
   commits, and creates a matching `vX.Y.Z` git tag. The tag **must** equal
   `v<package.json version>`, or electron-builder publishes a mismatched release.
3. **`git push --follow-tags`** — pushing the `v*` tag triggers
   `.github/workflows/release.yml` (macOS runner, `macos-14`): it re-runs the gate,
   then `pnpm release` (= `electron-builder --mac --publish always`) builds, signs,
   notarizes, and uploads `dmg` + `zip` + `latest-mac.yml`.
4. electron-builder uploads to a **draft** release. The workflow pre-creates a single
   draft (`gh release create "$GITHUB_REF_NAME" --draft --generate-notes`, idempotent
   via `gh release view ||`) before `pnpm release` so the dmg and zip uploaders share
   one release — without it each uploader created its own draft and split the assets.
   Open the draft on GitHub, verify the assets and notes, then **Publish** (and "Set
   as latest") so users and the auto-updater can see it. Draft-then-manually-publish
   is by design: electron-updater ignores drafts, so you can verify assets before
   going live.

## Signing & notarization

Release builds are signed + notarized. Identity is pinned in `electron-builder.yml`
(`notarize: true` + `identity` pinned to the Developer ID Application name — the
exported p12 also carries an Apple Development cert, so the identity must be explicit).

Secrets live on the repo (`gh secret list`), passed to `release.yml` via `env`:

| Secret | What |
|---|---|
| `CSC_LINK` | base64 Developer ID `.p12` |
| `CSC_KEY_PASSWORD` | the p12 password |
| `APPLE_ID` | Apple account for notarytool |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password |
| `APPLE_TEAM_ID` | `9QH8M89WF9` |

`GH_TOKEN` for the upload is the auto `GITHUB_TOKEN` (`permissions: contents: write`).
`packageManager` is pinned to `pnpm@10.26.1` so `pnpm/action-setup` resolves it.

**GOTCHA:** never map an *empty* `CSC_LINK` secret into env — a defined-but-empty
value makes electron-builder attempt signing and die with `<projectDir> not a file`.
Either set it real or omit it.

### Shipping unsigned instead

Drop the `CSC_*`/`APPLE_*` env from `release.yml`, set
`CSC_IDENTITY_AUTO_DISCOVERY: "false"`, and set `notarize: false` in
`electron-builder.yml`. Unsigned disables macOS auto-update.

## Changelog

`CHANGELOG.md` is generated from conventional commits by `conventional-changelog`
(the maintained CLI — `conventional-changelog-cli` is deprecated) with the
`conventionalcommits` preset. `pnpm changelog` =
`conventional-changelog -p conventionalcommits -i CHANGELOG.md -r 0` (full
deterministic regen from all `v*` tags; overwrites). The `version` lifecycle script
(`pnpm changelog && git add CHANGELOG.md`) runs it on every `pnpm version` bump and
folds the result into the `chore: release vX` commit. Only `feat`/`fix`/breaking
surface (preset default); `ci`/`chore`/`docs`/`refactor`/`test` are intentionally
hidden. `repository` in `package.json` makes commit/compare links resolve;
`CHANGELOG.md` is excluded from the packaged app in `electron-builder.yml`.

## Local builds

- `pnpm dist` — typecheck + build + signed DMG/ZIP into `dist/`, no publish.
- `pnpm release` — same + publish to GitHub releases `fabiofiorita/porcelain`
  (needs `GH_TOKEN`; the CI workflow is the normal path).

## See also

- `architecture` skill, "Packaging, signing, updates" — the durable config facts
  (`electron-builder.yml` targets, `electron-updater` wiring in `src/main/updater.ts`,
  icon pipeline).
- `audit` skill — the empty-`CSC_LINK` and dep-placement invariants.
