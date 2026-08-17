---
name: releasing
version: 0.53.2
metadata:
  internal: true
description: How to cut a Porcelain release — simple main+tag path, Mac package + npm, always patch unless asked. Read when publishing a version or changing signing/notarization.
---

# Porcelain — releasing

Side project, solo, **no real external users yet**. Shipping is occasional — when the human asks, not after every polish commit. Waiting ~10–15 minutes for a signed Mac build is fine.

**The desktop app ships for macOS only.** Linux is first-class as a *daemon* host via npm (`porcelain-daemon`); humans use the daemon-served browser client. Do not re-add a `linux:` block to `electron-builder.yml` without a real user asking.

**1.0.0 is far away** — only when the human feels the product is “done.” Until then: **always patch** unless they explicitly ask for minor/major.

## Shape (simple path)

```
main is good enough for daily use (web + daemon)
        │
        │  human: “release” / pnpm release
        ▼
  pnpm release:cut [patch|minor|major]   # default patch
        │  clean main == origin/main
        │  bump product version (all packages in sync) → commit + tag on main
        │  git push --follow-tags
        │  dispatch release.yml -f tag=vX.Y.Z
        ▼
  package-mac (build + sign + notarize, publish never)
        ▼
  GH Release (published + latest) + npm porcelain-daemon
```

**No pending task branches at cut time.** Day-to-day work lands on `main` (or through a
short-lived managed `work/*` PR), and release stays the same simple main+tag path after
`release-cut.mjs` has required clean `main == origin/main`. It sets `PORCELAIN_RELEASE_CUT=1`
for one reason only: to *deny* the Claude duplicate-skip, so the tracked hook still runs
`pnpm lint` on the nested commit `release-cut.mjs` makes — which the outer Claude/Grok hook
never sees. It never bypasses the gate. No multi-workflow pre-cut gate. No cut/retry/npm_only
mode soup.

Day-to-day proof is `pnpm verify` (before push) + browser e2e on CI / the **dev** stack — not this
workflow.

## Runbook

1. Land work on `main`, clean tree, `HEAD == origin/main`.
2. Cut:

   ```bash
   pnpm release:cut          # patch (default)
   pnpm release:cut minor    # only when the human asks
   # or: pnpm release
   ```

3. Watch:

   ```bash
   gh run watch --exit-status
   gh release view --json tagName,isDraft,assets
   ```

4. Optional: after packaging-touching changes, smoke the Mac install (PTY, updater, fuses) — see below.

## Retry

Re-run the failed GitHub job, or:

```bash
gh workflow run release.yml -f tag=v0.42.4
```

Do **not** invent a new patch for infra flake if the tag already exists and only packaging/publish failed. For product bugs: fix on main, then a **new** patch cut.

**One cut, watch it green, then stop.** Rapid successive patches correlate with npm tarball lag — don’t stack releases to “fix” packaging.

**Never rewrite pushed tags.**

## Local scripts

| Script | Role |
|---|---|
| `pnpm release` / `pnpm release:cut` | Bump + tag + push + dispatch |
| `pnpm package:mac` | `electron-builder --mac --publish never` |
| `pnpm release:publish` | Assemble GH release (CI uses this) |
| `pnpm release:fuse-smoke` | Artifact layout smoke |

## Changelog

`release-cut.mjs` bumps the canonical stamp (`apps/desktop` today; `apps/daemon` when extracted),
runs `scripts/sync-versions.mjs` so **every** workspace package shares that semver (including
mobile), then `pnpm changelog` (newest section only). Only `feat`/`fix`/breaking surface.
Empty-ish notes for tiny patches are fine; write a real blurb when the release *matters*.

## Signing & notarization

Identity in `electron-builder.yml`. Secrets on the repo for **package-mac** only:

| Secret | What |
|---|---|
| `CSC_LINK` | base64 Developer ID `.p12` |
| `CSC_KEY_PASSWORD` | p12 password |
| `APPLE_ID` | Apple account for notarytool |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password |
| `APPLE_TEAM_ID` | `9QH8M89WF9` |

**GOTCHA:** never map an empty `CSC_LINK` into env. Native `node-pty`: `asarUnpack` + signed under hardened runtime.

## npm (`porcelain-daemon`)

Published after the GitHub Release via **npm Trusted Publishing (OIDC)** — no long-lived `NPM_TOKEN`. Trusted publisher: owner **FabioFiorita**, repo `porcelain`, workflow **`release.yml`**.

**Post-publish gate (hard-won):** after `npm publish`, CI quietly curls the tarball until HTTP 200 (~10 min) and smokes `npx porcelain-daemon@VER --help` from a clean temporary consumer directory. A metadata-only / laggy publish once left `latest` on a **404 tarball**, which crash-looped every host on `npx porcelain-daemon@latest`. The registry commonly exposes metadata several minutes before its tarball CDN converges; those intermediate 404s are expected propagation, not separate release failures. "Version already exists" alone is **not** enough to skip — retries wait for the tarball and run the same consumer smoke.

**Never run that npx smoke inside `dist-daemon`.** Because the directory's package has the same name, npx can select the local package-under-build whose bin is not linked and fail with `porcelain-daemon: not found` even though npm is healthy. The smoke proves the published artifact only when its cwd has no local `porcelain-daemon`.

**No CI unpublish.** OIDC publish often returns success while the CDN stays 404 for minutes; auto-rollback caused false reds and unreliable state. If the probe times out: job fails and tells you to **re-run the same tag** later. If a version stays 404 for hours and poisons `latest`, unpublish **by hand** on npmjs.com (or pin the prod unit to a known-good version).

**CLI install layout** (`ensureCli`): installs `~/.porcelain/cli/porcelain.js` + `~/.porcelain/chunks/*` + wrapper (not a flat `porcelain.js` — the bundle `require`s `../chunks/…`).

After a good publish, the Linux **production** unit may still pin a version (e.g. `@0.43.3`) after a registry incident — only move it back to `@latest` once you've confirmed the tarball is 200.

## Electron fuses smoke (packaging-touching releases)

CI runs layout smoke only. On a real Mac install when packaging changed:

1. Terminal PTY spawns.
2. Updater launches without crash.
3. `ELECTRON_RUN_AS_NODE=1 open -a Porcelain` opens the GUI, not a Node REPL.
4. Daemon serves; process count stays sane.

## Prod vs dev (not a release concern)

Product work uses the **dev** daemon (`pnpm dev:daemon`, port **43118**, `~/.porcelain-dev`). The
production home (port **43117**, `~/.porcelain`) is real day-job work — agents never touch it while
polishing Porcelain. See root `AGENTS.md`.

## See also

- `docs/internals/repo.md` — packaging facts
- `AGENTS.md` — day-to-day delivery loop
