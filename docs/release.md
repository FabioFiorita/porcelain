# Release

Release operations are intentionally separate from the day-to-day development loop. Read the
release scripts and workflow output as the final authority if a command changes.

## Before cutting

- Work from `main` with a clean working tree.
- Make sure local `main` matches `origin/main`.
- Run the relevant checks and affected builds for the release.
- Confirm signing, npm, GitHub, and mobile credentials are available in the release environment.

The release cut defaults to a patch bump. Minor and major bumps require an explicit choice.

## Cut the version

```sh
pnpm release:cut              # patch
pnpm release:cut minor
pnpm release:cut major
pnpm release:cut patch --skip-push
```

The cut script uses `apps/desktop/package.json` as the current canonical version stamp, synchronizes
workspace package versions, updates the changelog, commits the version, creates an annotated tag,
and (unless skipped) pushes `main` with tags and dispatches the release workflow. It refuses a
dirty or non-main checkout and refuses a branch that is not aligned with `origin/main`.

## What the workflow publishes

The release workflow packages the macOS desktop application and the plain-Node daemon in parallel,
publishes a GitHub Release, and publishes the prepared daemon package to npm. Desktop packaging
includes the Electron app and native dependencies. The macOS artifact path must preserve the
configured artifact name; do not reintroduce a raw scoped package name into the filename.

Mobile is an active product surface but is released through its Expo/EAS path, not as part of every
desktop/daemon release. Use the mobile release procedure and the credentials appropriate to the
target profile.

## Publish and retry

The publish script accepts a tag and one or more asset directories:

```sh
node scripts/release-publish.mjs --tag vX.Y.Z --assets dist-mac
```

It creates or updates a non-draft latest GitHub Release, uploads assets, and confirms the release
has assets. Add `--cleanup-drafts` only when old failed draft releases should be removed. A failed
workflow job can normally be retried from GitHub Actions or rerun with the same tag; do not rewrite
an existing Git tag.

## Smoke checks

Use the release fuse smoke script against the packaged output when native packaging changed:

```sh
node scripts/release-fuse-smoke.mjs --platform mac --dir apps/desktop/dist
```

Confirm that the desktop artifact launches, the daemon distribution contains its native terminal
dependency, and the published daemon can serve. Treat a failed smoke check as a release issue, not
as a reason to weaken the normal development loop.
