---
name: release
description: Release a new Porcelain version (the npm package and the notarized Mac app) by bumping the version and pushing a tag. Use when asked to release, publish or cut a version.
---

# Release

The version in the root `package.json` is the one version for the npm package `@fabiofiorita/porcelain`, the Mac app and its server. Pushing a tag `v<version>` runs `.github/workflows/release.yml`: it builds the notarized Mac disk image, publishes the npm package, then creates the GitHub release with the image and generated notes. The owner approves every release.

1. **Bump.** Set `version` in the root `package.json` (minor for features, patch for fixes). Open a pull request `Release <version>` and merge it once CI is green.
2. **Rehearse (optional).** `gh workflow run release.yml` on `main` builds, signs and notarizes the Mac app and publishes nothing. Use it after changing the build or the workflow.
3. **Tag.** On the merged commit: `git tag -a v<version> origin/main -m "Porcelain <version>"`, then `git push origin v<version>`. The workflow refuses a tag that does not match `package.json`, is not on `main`, or is already released.
4. **Confirm.** Watch `gh run list --workflow release.yml`. The release is done when `npm view @fabiofiorita/porcelain dist-tags` shows the version as `latest` and the GitHub release carries `Porcelain-<version>-arm64.dmg`.

## When it fails

- **Before npm publishes** (the version or mac job): fix on `main`, delete the tag (`git push origin :refs/tags/v<version>`) and tag the fixed commit again.
- **After npm publishes:** re-run the failed jobs. The publish step skips a version npm already has, so the check and the GitHub release finish. Never move a tag or reuse a version that npm already has; bump instead.

## What it relies on

- Repository secrets: `CSC_LINK` and `CSC_KEY_PASSWORD` (the Developer ID certificate as a base64 `.p12`), `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`.
- An npm trusted publisher on `@fabiofiorita/porcelain` for this repository and `release.yml`. npm needs no token.

Installed services update through Settings → Update or `porcelain service update`. The Mac app has no updater yet: install the disk image from the release.
