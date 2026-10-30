---
name: release
description: Release a new Porcelain version (the npm package and the notarized Mac app) by bumping the version and pushing a tag. Use when asked to release, publish or cut a version.
---

# Release

The version in the root `package.json` is the one version for the npm package `@fabiofiorita/porcelain`, the Mac app and its server. Pushing a tag `v<version>` runs `.github/workflows/release.yml`: it builds the notarized Mac disk image and the update files, creates the GitHub release with them and generated notes, then checks the packed npm package and publishes it. A final, separate job installs the published package from npm. The owner approves every release.

1. **Bump.** Set `version` in the root `package.json` (minor for features, patch for fixes). Open a pull request `Release <version>` with auto-merge off; the owner approves the release by merging it.
2. **Rehearse (optional).** `gh workflow run release.yml` on `main` builds, signs and notarizes the Mac app and publishes nothing. Use it after changing the build or the workflow.
3. **Tag.** On the merged commit: `git tag -a v<version> origin/main -m "Porcelain <version>"`, then `git push origin v<version>`. The workflow refuses a tag that does not match `package.json` or is not on `main`. Re-runs preserve an existing GitHub release and skip an npm version that is already published.
4. **Confirm.** Watch `gh run list --workflow release.yml`. The release is done when `npm view @fabiofiorita/porcelain dist-tags` shows the version as `latest` and the GitHub release carries `Porcelain-<version>-arm64.dmg`, `Porcelain-<version>-arm64-mac.zip` and `latest-mac.yml`.

## When it fails

- **Before anything publishes** (the version or mac job): fix on `main`, delete the tag (`git push origin :refs/tags/v<version>`) and tag the fixed commit again.
- **GitHub release job:** inspect whether the release was created, then re-run the failed jobs for a transient failure. A re-run finishes uploading and publishing an interrupted draft, or keeps an already published release and its assets, then continues to npm.
- **npm job:** the GitHub release and Mac update feed are already available. Re-run the failed jobs for a transient failure; the packed package is checked before publishing and the publish step skips a version npm already has.
- **npm-check job:** the GitHub release and npm publication have finished. This job waits up to 30 minutes for npm processing and propagation, then checks the installed CLI version. If it still fails, inspect npm availability or the reported CLI error and re-run only the failed job after resolving it. This failure cannot block the GitHub release or Mac updates.
- **After either GitHub or npm publishes:** never move the tag or reuse the version for different code; bump instead if a code change is needed.

## What it relies on

- Repository secrets: `CSC_LINK` and `CSC_KEY_PASSWORD` (the Developer ID certificate as a base64 `.p12`), `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`.
- An npm trusted publisher on `@fabiofiorita/porcelain` for this repository and `release.yml`. npm needs no token.

Installed services update through Settings → Update or `porcelain service update`. The Mac app updates itself from Settings → Update: it reads `latest-mac.yml` from the newest GitHub release, downloads the zip of the signed app it names, and restarts into it. Only release builds carry the update feed; a local build (`pnpm desktop:build`, `pnpm dev --desktop`) reports updates as unavailable. Apps from 0.65.1 and earlier have no updater: install the first self-updating version from its disk image once.

## Signed local verification

For packaged-app verification without Apple submission, run
`pnpm desktop:build --signed-verification` from an isolated checkout at the exact
candidate commit on macOS. It requires the existing
`PORCELAIN_MAC_SIGNING_IDENTITY` and optionally uses `PORCELAIN_MAC_KEYCHAIN`.
A missing, blank or ad-hoc (`-`) identity is refused before staging; the signer
validates the configured identity normally. No Apple ID, app-specific password
or team environment is required.

This mode uses the same hardened runtime, project release entitlements, ASAR
layout and locked Electron fuses as `--release`. It returns only the signed app
under `dist/desktop`, with no notarization, stapling, update feed, disk image,
update archive or publication. It proves signed packaged runtime behavior;
notarization and Gatekeeper distribution acceptance remain separate release
proofs. Do not install the candidate into Applications or use installed app data:
launch its absolute executable with a disposable profile and fixture repository.
The default development build and notarized `--release` path retain their
existing behavior. `--signed-verification` and `--release` are mutually exclusive.
