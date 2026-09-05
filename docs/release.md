# Release

Releases require explicit authorization. Use this guide to choose the operation, then inspect the
owning script or workflow for current inputs, credentials, artifacts, and gates.

## Desktop and daemon

Work from clean `main` aligned with `origin/main`, with relevant checks and affected builds passing.

```sh
pnpm release:cut              # patch, commit, tag, push, and workflow dispatch
pnpm release:cut minor
pnpm release:cut major
pnpm release:cut patch --skip-push  # local commit and tag only
```

The patch bump is the default; choose minor or major deliberately. Read
[release-cut.mjs](../scripts/release-cut.mjs) before running it. Version synchronization is owned by
[sync-versions.mjs](../scripts/sync-versions.mjs); the shipped plugin has its own version.

[The release workflow](../.github/workflows/release.yml) defines packaging, signing secrets, npm
publication, and GitHub assets. It also owns the Windows signed/unsigned gate and registry readiness
checks. Preserve artifact names. First-time WSL setup depends on the matching daemon version being
available from npm, so desktop availability alone does not establish release completion.

For a failed run, retry the same tag after resolving the failure. Do not rewrite an existing tag or
cut another version merely because registry propagation is slow. Run consumer checks outside
`dist-daemon` so `npx` cannot select the local package.

For explicitly authorized manual publication or recovery:

```sh
node scripts/release-publish.mjs --tag vX.Y.Z --assets dist-mac
```

[The publish script](../scripts/release-publish.mjs) requires an existing remote tag. It uploads
and checks asset names and sizes before publishing a draft. Failed drafts remain available for
retry; other releases are left alone.

## Mobile

Mobile delivery is separate from desktop/daemon publication. Build profiles and credentials are
configured in [eas.json](../apps/mobile/eas.json). Local build/install commands live in
[the mobile package scripts](../apps/mobile/package.json).

Choose the intended delivery from the mobile directory:

```sh
cd apps/mobile
eas workflow:run .eas/workflows/preview.yml
eas workflow:run .eas/workflows/production.yml
```

Read [preview](../apps/mobile/.eas/workflows/preview.yml) for internal iOS delivery and
[production](../apps/mobile/.eas/workflows/production.yml) for App Store Connect submission.
Preview devices must be registered with EAS before installing an ad-hoc IPA. App Store processing,
review, and public release remain separate actions in App Store Connect.

When intentionally building and submitting locally on a Mac:

```sh
eas build --platform ios --profile production --local --output /tmp/porcelain-production.ipa
eas submit --platform ios --profile production --path /tmp/porcelain-production.ipa --wait
```

Submit the exact artifact built for the intended release. Local compilation may still need Expo
metadata and credentials.

## Release evidence

For native packaging changes, use [the fuse smoke script](../scripts/release-fuse-smoke.mjs):

```sh
node scripts/release-fuse-smoke.mjs --platform mac --dir apps/desktop/dist
node scripts/release-fuse-smoke.mjs --platform win --dir apps/desktop/dist
```

Confirm the packaged desktop launches and the published daemon serves with a working terminal.
On a real Mac, exercise the updater launch path and `ELECTRON_RUN_AS_NODE=1 open -a Porcelain`.
A workflow success or cache hit does not replace native runtime evidence.
