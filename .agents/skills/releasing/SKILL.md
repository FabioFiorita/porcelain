---
name: releasing
metadata:
  internal: true
description: How to cut a Porcelain release — simple main+tag path, Mac package + npm, always patch unless asked. Read when publishing a version or changing signing/notarization.
---

# Porcelain — releasing

Side project, solo, **no real external users yet**. Shipping is occasional — when the human asks, not after every polish commit. Waiting ~10–15 minutes for a signed Mac build is fine.

**The desktop app ships for macOS only** (2026-07-27). Linux is first-class as a *daemon* host via npm (`porcelain-daemon`); humans use the daemon-served browser client. Do not re-add a `linux:` block to `electron-builder.yml` without a real user asking.

**1.0.0 is far away** — only when the human feels the product is “done.” Until then: **always patch** unless they explicitly ask for minor/major.

## Shape (2026-07-27 — simple path)

```
main is good enough for daily use (web + daemon)
        │
        │  human: “release” / pnpm release
        ▼
  pnpm release:cut [patch|minor|major]   # default patch
        │  clean main == origin/main
        │  pnpm version → commit + tag on main
        │  git push --follow-tags
        │  dispatch release.yml -f tag=vX.Y.Z
        ▼
  package-mac (build + sign + notarize, publish never)
        ▼
  GH Release (published + latest) + npm porcelain-daemon
```

**No pending branches.** No multi-workflow pre-cut gate. No cut/retry/npm_only mode soup.

Day-to-day proof is `pnpm verify` + browser e2e on the **dev** stack — not this workflow.

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

**Never rewrite pushed tags.**

## Local scripts

| Script | Role |
|---|---|
| `pnpm release` / `pnpm release:cut` | Bump + tag + push + dispatch |
| `pnpm package:mac` | `electron-builder --mac --publish never` |
| `pnpm release:publish` | Assemble GH release (CI uses this) |
| `pnpm release:fuse-smoke` | Artifact layout smoke |

`pnpm release:check` is a no-op pointer at the new path (old multi-gate removed).

## Changelog

`pnpm version` runs the `version` lifecycle → `pnpm changelog` (newest section only). Only `feat`/`fix`/breaking surface. Empty-ish notes for tiny patches are fine; write a real blurb when the release *matters*.

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

Published after the GitHub Release via **npm Trusted Publishing (OIDC)** — no long-lived `NPM_TOKEN`. Trusted publisher: owner **FabioFiorita**, repo `porcelain`, workflow **`release.yml`**. Idempotent skip if that version is already on the registry.

After publish, the Linux **production** systemd unit still runs `npx porcelain-daemon@latest` — restart the unit when you want the new daemon.

## Electron fuses smoke (packaging-touching releases)

CI runs layout smoke only. On a real Mac install when packaging changed:

1. Terminal PTY spawns.
2. Updater launches without crash.
3. `ELECTRON_RUN_AS_NODE=1 open -a Porcelain` opens the GUI, not a Node REPL.
4. Daemon serves; process count stays sane.

## Prod vs dev (not a release concern)

Product work uses the **dev** daemon (`pnpm dev:daemon`, port **43118**, `~/.porcelain-dev`). The always-on Linux daemon (port **43117**, `~/.porcelain`) is production for the human’s day job — agents never touch it while polishing Porcelain. Details in `close-the-loop` / `architecture`.

## See also

- `architecture` skill — packaging facts
- `audit` skill — empty-`CSC_LINK`, node-pty unpack
- `close-the-loop` — day-to-day loop (not release)
