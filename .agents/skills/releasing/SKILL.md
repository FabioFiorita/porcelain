---
name: releasing
metadata:
  internal: true
description: How to cut a Porcelain release — gate-then-cut, atomic multi-platform publish, auto-latest, signing secrets, changelog, and retry-without-bump. Read when publishing a version, debugging the release workflow, or changing signing/notarization.
---

# Porcelain — releasing

Cutting a release publishes a **signed + notarized** macOS build to GitHub Releases
for `electron-updater`, plus an **unsigned** Linux build (AppImage + deb) into the
**same** release, marks it **latest** automatically, and publishes
`porcelain-daemon` to npm via OIDC.

## Design (2026-07-24 overhaul)

**Problem we fixed:** tag-then-discover burned versions (~35% of tag pushes failed on
e2e/lint/packaging). Recovery was always a new patch. Drafts and half-releases
(Mac without Linux, npm without assets) littered the release list.

**Shape now:**

```
main always green (CI + Linux + native dry-run on every push)
        │
        ▼
  pnpm release:check && pnpm release:cut [patch|minor|major]
        │  (or: Actions → Release → bump=…)
        ▼
  prepare: version bump on release/pending-vX only (no tag, not on main yet)
        │
        ├─ package-mac  (e2e → sign/notarize → artifacts, publish never)
        └─ package-linux (e2e → package → artifacts, publish never)
        │
        ▼ only if BOTH green
  publish: promote pending → main
        → GH Release (published + latest) with all assets + tag
        → npm publish
        → delete leftover drafts
```

Failure before promote = **no version on main, no tag, no half-release**.
Promote-before-publish so a live "latest" never exists without the version commit on main.
Infra flake after a good package = **retry the same tag** (no new patch).

## Runbook (primary path)

1. Land changes on `main` and wait for **all three** required workflows to go green
   on that exact SHA:
   - `ci.yml` — `pnpm verify` + `typecheck:e2e`
   - `linux.yml` — browser e2e + Linux package (artifact only)
   - `e2e-native-dry-run.yml` — full native Electron e2e on `macos-14`
     (**every** push to main, not path-filtered)

2. **Pre-cut gate (local):**

   ```bash
   pnpm release:check
   ```

   Fails closed unless HEAD is on clean `main`, matches `origin/main`, and all three
   workflows above are **success** for that SHA. Do not cut until this is green.

3. **Cut (does not bump locally):**

   ```bash
   pnpm release:cut          # patch
   pnpm release:cut minor
   # or: gh workflow run release.yml -f bump=patch
   ```

   This only dispatches `.github/workflows/release.yml`. The workflow:

   - Bumps `package.json` + prepends `CHANGELOG.md` via `pnpm version` onto
     `release/pending-vX.Y.Z` (force-pushed; **not** merged to main yet; **no tag**).
   - Runs **package-mac** and **package-linux** in parallel against that ref
     (lint/test/build/e2e → `electron-builder --publish never` → upload artifacts).
   - **Only if both succeed:** promotes the pending branch to `main`, then
     assembles one GitHub Release with **all** assets **published and marked
     latest** (not draft; creates the tag at that commit), publishes npm, deletes
     other leftover **draft** releases (tags kept — never rewrite tags).
   - If packaging fails: deletes the pending branch; main and tags unchanged.

4. **Watch the run to completion** (Agent tab: block in one turn — do not fire-and-forget):

   ```bash
   gh run watch --exit-status   # or gh run watch <id> --exit-status
   gh release view --json tagName,isDraft,isLatest,assets
   ```

   Auto-latest means you should **not** need `gh release edit --draft=false --latest`
   anymore. If a run fails, read the failed job; do not burn a new version for
   notarize/GH/npm flakes — use **retry** below.

5. **Electron fuses smoke** (still required for a human when you have a machine):
   after the first cut of a packaging-touching change, verify the four checks in
   the fuses section below. Day-to-day CI has packaging layout smoke + native e2e;
   it does not fully replace a local install smoke on a real Mac.

## Retry (same tag — infra only)

When packaging was green but publish/notarize/npm/GH flaked, or you need to
re-upload assets for an existing tag:

```bash
gh workflow run release.yml -f tag=v0.40.0
# bump is ignored when tag is set
```

Or re-run the failed jobs on the existing workflow run (`gh run rerun <id> --failed`).

**Do not** retry-same-tag for product/e2e bugs — fix on main, `pnpm release:check`,
then `pnpm release:cut` for a **new** patch.

Tag push is **not** a workflow trigger (avoids double-build races). Retry is always
`workflow_dispatch` with `tag=`.

## Recovery rules

| Failure | Recovery |
|---|---|
| `release:check` red | Wait for / fix CI, Linux, or native dry-run on HEAD |
| package-mac / package-linux red | Fix on main (no version burned), re-cut |
| publish / notarize / npm infra | Retry same tag or `gh run rerun --failed` |
| Product bug after a live release | New patch cut (never rewrite a pushed tag) |

**Never rewrite pushed tags** (Fabio's rule). Failed *drafts* from the old pipeline
are deleted automatically on the next successful publish (`--cleanup-drafts`).

## Local scripts

| Script | Role |
|---|---|
| `pnpm release:check` | `scripts/release-check.mjs` — pre-cut gate |
| `pnpm release:cut` | `scripts/release-cut.mjs` — check + dispatch |
| `pnpm package:mac` / `package:linux` | `electron-builder --publish never` |
| `pnpm release:publish` | `scripts/release-publish.mjs` — assemble GH release (CI uses this) |
| `pnpm release:fuse-smoke` | packaging layout smoke (dmg/zip/yml or AppImage/deb/yml) |

Do **not** run `pnpm version` + `git push --follow-tags` as the normal path — that
was the old tag-then-discover flow. Prefer `release:cut`. Emergency local bump is
still possible but then you rely on the tag-push retry path and accept that the
version commit is already on main before packaging proves out.

## Changelog

Unchanged: `pnpm changelog` =
`conventional-changelog -p conventionalcommits -i CHANGELOG.md -r 1` (newest
section only; never `-r 0`). The `version` lifecycle hook runs it during the
workflow's `pnpm version` on the pending branch. Only `feat`/`fix`/breaking surface.

## Signing & notarization

Identity pinned in `electron-builder.yml` (`notarize: true` + Developer ID name).
Secrets on the repo (`gh secret list`), passed to **package-mac** only:

| Secret | What |
|---|---|
| `CSC_LINK` | base64 Developer ID `.p12` |
| `CSC_KEY_PASSWORD` | the p12 password |
| `APPLE_ID` | Apple account for notarytool |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password |
| `APPLE_TEAM_ID` | `9QH8M89WF9` |

`GH_TOKEN` is the auto `GITHUB_TOKEN` (`permissions: contents: write`).
`packageManager` is pinned to `pnpm@11.7.0`.

**GOTCHA:** never map an *empty* `CSC_LINK` into env — omit or set real.
**Native module (`node-pty`):** `asarUnpack` + signed under hardened runtime; CI
`pnpm install` runs `electron-builder install-app-deps` (don't `--ignore-scripts`).

## npm (`porcelain-daemon`)

Published in `publish-npm` after the GitHub Release succeeds, via **npm Trusted
Publishing (OIDC)** — no long-lived `NPM_TOKEN`. Configure once on
[npmjs.com/package/porcelain-daemon](https://www.npmjs.com/package/porcelain-daemon)
→ Trusted Publisher: GitHub Actions, owner **`FabioFiorita`** (casing must match
OIDC), repo `porcelain`, workflow **`release.yml`**. Retry is idempotent (skips if
that version is already on the registry).

## Electron fuses smoke test (required on packaging-touching releases)

`electron-builder.yml` wires `build/after-pack.js` (`afterPack`) before signing.
CI runs `scripts/release-fuse-smoke.mjs` (artifact layout only). After a packaging
change, also verify on a real install:

1. **Terminal PTY spawns** in the installed app.
2. **Updater launches without crash.**
3. **`RunAsNode` is disabled:** `ELECTRON_RUN_AS_NODE=1 open -a Porcelain` must
   open the GUI, not a Node REPL.
4. **Daemon serves** (file tree loads; process count stays sane — utilityProcess
   fork, never re-spawn the app binary with `ELECTRON_RUN_AS_NODE`).

If any check fails, do not treat the auto-published release as good — cut a fix
patch immediately.

## Agent-tab babysit

Agent-tab turns are headless per message: never start a background monitor and
end the turn with "I'll report back." Block on `gh run watch --exit-status` in
**one** turn. Auto-latest means the follow-up is usually just verifying the
release JSON, not manually undrafting.

## See also

- `architecture` skill, "Packaging, signing, updates"
- `audit` skill — empty-`CSC_LINK`, dep-placement, node-pty unpack
