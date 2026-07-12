---
name: releasing
metadata:
  internal: true
description: How to cut a Porcelain release — bump/tag, the GitHub Actions release pipeline, signing & notarization secrets, changelog generation, and the draft-then-publish flow for electron-updater. Read when publishing a new version, debugging the release workflow, or changing signing/notarization.
---

# Porcelain — releasing

Cutting a release publishes a **signed + notarized** macOS build to GitHub Releases
for `electron-updater`.

## Runbook

1. Land your changes on `main` and confirm CI is green (`.github/workflows/ci.yml`
   runs on every push to `main` + PRs: install → lint → typecheck → test → build on
   Ubuntu).
2. **The e2e suite is the release gate, and it runs in CI — not on your machine.**
   `release.yml` (`macos-14`) builds **once** on the tag push, then runs
   `pnpm test:e2e:prebuilt` against that build: Playwright drives the real built app,
   `-darwin` screenshot baselines included, and the same `out/` is what ships. You
   do **not** run it locally before tagging. (It's kept OUT of the per-commit gate,
   hard rule 3, so commits stay fast; and out of the Ubuntu `ci.yml`, which can't
   launch the app or assert the `-darwin` baselines — `ci.yml` only `typecheck:e2e`s.)
   The one time you still touch e2e locally: when you change the UI **on purpose**,
   regenerate the baselines with `pnpm test:e2e:update` and commit them (`test:`) as
   part of that change — otherwise the stale snapshot stays hidden until the release
   workflow fails on the diff (Ubuntu CI never runs e2e). A pure-refactor release
   needs no baseline change.

   **Why we trust the runner (decided 2026-06-26).** The baselines are authored on the
   dev machine, but the `macos-14` runner has asserted them green across eight straight
   releases (0.11.0 → 0.16.2), so dev-machine and runner rendering match in practice —
   the old "assert locally, the runner isn't where we assert" caveat was disproven by
   that streak. The tradeoff we accepted: an *unintentional* visual regression now
   fails the release workflow *after* the tag is pushed, rather than locally before it.
   Recoverable — fix and bump a NEW patch (see below), just later in the flow.

   **Failed-release recovery: never rewrite pushed history — add a new patch
   (Fabio's rule, 2026-07-12).** When a release run fails after the tag is pushed,
   do NOT delete, move, or force-push the tag (or any pushed commit): commit the fix
   on main, `pnpm version patch`, and release the new version. The dead tag stays on
   origin as an honest record of the attempt (it has no release attached, so
   electron-updater never sees it; its changelog section stays too — the fixed
   version's section will just be short). First applied on v0.21.0/v0.21.1 (both died
   on the same e2e strict-mode locator; v0.21.2 shipped the fix). Corollary: before
   cutting a release after ANY UI-touching commits, run the full `pnpm
   test:e2e:prebuilt` suite locally — an ambiguous locator is deterministic on the
   runner even when a local race lets it pass once, and each failed attempt costs a
   version number.
3. **Bump and tag in one step:** `pnpm version <patch|minor|major>` — updates
   `package.json`, **prepends** the new release's section to `CHANGELOG.md` from the
   conventional commits (the `version` lifecycle hook → `pnpm changelog`, staged into
   the release commit), commits, and creates a matching `vX.Y.Z` git tag. The tag
   **must** equal `v<package.json version>`, or electron-builder publishes a
   mismatched release. (`pnpm changelog` only writes the *newest* section and leaves
   published history alone — see Changelog below for why and the hook-ordering catch.)
4. **`git push --follow-tags`** — pushing the `v*` tag triggers
   `.github/workflows/release.yml` (macOS runner, `macos-14`): lint → test → build →
   `test:e2e:prebuilt` → `pnpm release:prebuilt` (= `electron-builder --mac
   --publish always`, packaging the already-built `out/`) signs, notarizes, and
   uploads `dmg` + `zip` + `latest-mac.yml`. One build; the artifact that ships is
   the artifact e2e tested (reordered 2026-07-05, plan 029 — the old flow built a
   second, untested bundle inside `pnpm release`).
5. electron-builder uploads to a **draft** release. The workflow pre-creates a single
   draft (`gh release create "$GITHUB_REF_NAME" --draft --generate-notes`, idempotent
   via `gh release view ||`) before `pnpm release:prebuilt` so the dmg and zip uploaders share
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

**Native module (`node-pty`) — signing + notarization.** As of the embedded terminal,
the app ships one native dependency. `electron-builder.yml` `asarUnpack`s
`node_modules/node-pty/**`, so its `pty.node` AND its `spawn-helper` Mach-O binary land
in `app.asar.unpacked` and get **signed under the hardened runtime + notarized** like
the rest of the bundle. Two things to watch on a signed release: (1) the CI runner must
rebuild it for Electron's ABI — the workflow's `pnpm install` runs the
`electron-builder install-app-deps` postinstall, so this is automatic, but a `--ignore-scripts`
install would silently ship a node-ABI binary that crashes on launch; (2) if notarization
ever rejects an unsigned/!hardened `spawn-helper`, confirm it's inside `asarUnpack`
(electron-builder only signs unpacked binaries). The renderer's xterm.js is bundled, not
native — no signing concern.

## Changelog

`CHANGELOG.md` is generated from conventional commits by `conventional-changelog`
(the maintained CLI — `conventional-changelog-cli` is deprecated) with the
`conventionalcommits` preset. `pnpm changelog` =
`conventional-changelog -p conventionalcommits -i CHANGELOG.md -r 1` — generate **only
the newest release** and **prepend** it to the existing file; published sections are
never touched. The `version` lifecycle script (`pnpm changelog && git add CHANGELOG.md`)
runs it on every `pnpm version` bump and folds the result into the `chore: release vX`
commit. Only `feat`/`fix`/breaking surface (preset default); `ci`/`chore`/`docs`/
`refactor`/`test` are intentionally hidden. `repository` in `package.json` makes
commit/compare links resolve; `CHANGELOG.md` is excluded from the packaged app in
`electron-builder.yml`.

**Why `-r 1`, not `-r 0` (this bit us once).** `-r 0` means "regenerate the *whole*
changelog from git tags and overwrite the file" — it ignores the existing
`CHANGELOG.md` entirely and rebuilds every section from whatever `v*` tags happen to
be present locally at that instant. That's fragile: if any prior release's tag is
missing when the hook fires, that section silently vanishes and its commits get
swept into the new block. Cutting v0.9.0 it dropped the entire `## [0.8.0]` section
and merged 0.8.0's four commits up into 0.9.0 (its compare link even came out
`v0.7.1...v0.9.0`). `-r 1` is additive — it only computes the new section from
`git log <latest-tag>..HEAD` and prepends; even with a missing prior tag it leaves
published history byte-for-byte intact. Never go back to `-r 0`.

**Hook-ordering catch.** `pnpm version` runs the lifecycle hook *before* it commits
and tags, so when `pnpm changelog` fires the new `vX.Y.Z` tag does **not** exist yet —
the latest tag is the *previous* release and the new commits read as "unreleased,"
which is exactly what makes `-r 1` emit the new section (header version from the
already-bumped `package.json`). Corollary: running `pnpm changelog` *by hand* after
`pnpm version` has finished produces **nothing** — HEAD already sits on the fresh tag,
so there are no unreleased commits. Don't "fix" the changelog that way; if you need to
regenerate, do it from the pre-tag state.

## Local builds

- `pnpm dist` — typecheck + build + signed DMG/ZIP into `dist/`, no publish.
- `pnpm release` — same + publish to GitHub releases `fabiofiorita/porcelain`
  (needs `GH_TOKEN`; the CI workflow is the normal path).

## Electron fuses smoke test (required on every packaged build)

`electron-builder.yml` wires `build/after-pack.js` as an `afterPack` hook that
flips Electron security fuses on the `.app` before signing. The standard gate
(`pnpm verify`) does NOT exercise fuses — they only take effect in a packaged
build. After every `pnpm dist` or release build, verify **all four** before
publishing:

1. **Terminal PTY spawns.** Open a terminal tab in the installed app and run any
   command. A PTY must spawn and show output. This proves the unpacked
   `node-pty` native addon (`pty.node` + `spawn-helper` in `app.asar.unpacked`)
   still loads correctly under `OnlyLoadAppFromAsar: true`. If the terminal
   silently fails to spawn, the fuse is interacting with the unpacked addon —
   STOP, drop `OnlyLoadAppFromAsar` from `build/after-pack.js`, and re-build.

2. **Updater launches without crash.** Launch the packaged app and let it reach
   the main window without an error dialog or crash. The updater (`electron-updater`,
   `src/main/updater.ts`) runs at launch; a fuse-related failure surfaces here in
   the main log.

3. **`RunAsNode` is disabled.** From a terminal:
   `ELECTRON_RUN_AS_NODE=1 open -a Porcelain`
   The app must open as the normal GUI app, NOT as a Node REPL. If it drops to a
   Node prompt, the `RunAsNode: false` fuse did not take effect.

4. **The daemon serves.** After launch, the app's total process count stays
   sane (~7, not multiplying — a utilityProcess child does NOT show
   `daemon/server.js` in `ps` argv, so don't grep for that), `lsof` shows ONE
   Porcelain process LISTENing on 127.0.0.1, and an unauthed `curl` to its
   `/trpc` returns 401 — or simply: the app's file tree loads, which requires
   the daemon; a PTY spawn (check 1) doubles as the node-pty proof over the
   same daemon. A multiplying process count is the RunAsNode/spawn
   regression: the daemon must be forked via `utilityProcess.fork`, never by
   re-spawning the app binary with `ELECTRON_RUN_AS_NODE` (the fuse silently
   ignores it and the child boots as a second GUI app, recursively — this
   fork-bombed the v0.19.0 draft).

If any check fails, do NOT publish the draft release. Report the exact failure
before proceeding.

## See also

- `architecture` skill, "Packaging, signing, updates" — the durable config facts
  (`electron-builder.yml` targets, `electron-updater` wiring in `src/main/updater.ts`,
  icon pipeline).
- `audit` skill — the empty-`CSC_LINK` and dep-placement invariants.
