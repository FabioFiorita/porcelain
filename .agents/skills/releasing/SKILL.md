---
name: releasing
metadata:
  internal: true
description: How to cut a Porcelain release — bump/tag, the GitHub Actions release pipeline, signing & notarization secrets, changelog generation, and the draft-then-publish flow for electron-updater. Read when publishing a new version, debugging the release workflow, or changing signing/notarization.
---

# Porcelain — releasing

Cutting a release publishes a **signed + notarized** macOS build to GitHub Releases
for `electron-updater`, plus an **unsigned** Linux build (AppImage + deb) into the
same release.

## Runbook

1. Land your changes on `main` and confirm CI is green (`.github/workflows/ci.yml`
   runs on every push to `main` + PRs: `pnpm verify` = lint → test → build —
   typecheck runs inside `build` — then `typecheck:e2e`, on Ubuntu).
2. **Native e2e before the tag (dry-run), not only after.**
   - **Per-push browser e2e** (`linux.yml` → `pnpm test:e2e`): headless Chromium on
     the daemon-served client; asserts `-browser-linux` baselines.
   - **Pre-tag native dry-run** (`e2e-native-dry-run.yml`): full
     `pnpm test:e2e:native:prebuilt` on `macos-14` after UI/e2e path changes on
     main, or via workflow_dispatch. **Do not `pnpm version` after UI-touching
     commits until this is green** (or you have regenerated baselines and
     re-run). Locators are `data-testid` (`src/shared/test-ids.ts`); intentional
     UI still needs baseline updates when visuals change.
   - **Tag release gate** (`release.yml`): same native suite on mac + Linux xvfb
     against the artifact that ships — confirmation, not first discovery.
   - When you change the UI **on purpose**, regenerate baselines in the same
     change: `pnpm test:e2e:update` (browser) and darwin via
     `regen-darwin-baselines.yml` / `pnpm test:e2e:native:update` when you have a
     display. A pure-refactor release needs no baseline change.

   **Why we trust the runner (decided 2026-06-26).** The `macos-14` runner has
   asserted baselines green across many releases; dry-run uses the same runner so
   tag-time should match.

   **Failed-release recovery: never rewrite pushed history — add a new patch
   (Fabio's rule, 2026-07-12).** When a release run fails after the tag is pushed,
   do NOT delete, move, or force-push the tag: commit the fix on main, `pnpm
   version patch`, and release the new version. The dry-run workflow exists so
   this path is rare.
3. **Bump and tag in one step:** `pnpm version <patch|minor|major>` — updates
   `package.json`, **prepends** the new release's section to `CHANGELOG.md` from the
   conventional commits (the `version` lifecycle hook → `pnpm changelog`, staged into
   the release commit), commits, and creates a matching `vX.Y.Z` git tag. The tag
   **must** equal `v<package.json version>`, or electron-builder publishes a
   mismatched release. (`pnpm changelog` only writes the *newest* section and leaves
   published history alone — see Changelog below for why and the hook-ordering catch.)
   `pnpm version` uses a bare-number commit message — amend to `chore: release vX.Y.Z`
   and re-tag BEFORE pushing (never after). **Re-tag with `git tag -fa vX.Y.Z -m
   "vX.Y.Z" HEAD`, not plain `git tag -f`:** `pnpm version` makes an *annotated* tag,
   a plain `-f` re-tag downgrades it to lightweight, and `--follow-tags` only pushes
   annotated tags — the tag silently stays local and release.yml never fires (bit
   v0.23.0; the fix is safe because the tag never reached origin — push it explicitly
   with `git push origin vX.Y.Z` if you notice no tag ref in the push output).
4. **`git push --follow-tags`** — pushing the `v*` tag triggers
   `.github/workflows/release.yml` (macOS runner, `macos-14`): lint → test → build →
   `test:e2e:native:prebuilt` → `pnpm release:prebuilt` (= `electron-builder --mac
   --publish always`, packaging the already-built `out/`) signs, notarizes, and
   uploads `dmg` + `zip` + `latest-mac.yml`. One build; the artifact that ships is
   the artifact e2e tested (reordered 2026-07-05, plan 029 — the old flow built a
   second, untested bundle inside `pnpm release`). After the Mac publish step, the
   workflow runs `pnpm daemon:dist` and `npm publish ./dist-daemon` via **npm
   Trusted Publishing (OIDC)** — no long-lived `NPM_TOKEN`. The job needs
   `permissions.id-token: write`; npm exchanges the GitHub OIDC token for a
   short-lived publish credential. Configure once on the package
   ([npmjs.com/package/porcelain-daemon](https://www.npmjs.com/package/porcelain-daemon)
   → Settings → Trusted Publisher): GitHub Actions, user `FabioFiorita`, repo
   `porcelain`, workflow filename **`release.yml`** (filename only), allow
   `npm publish`. **Owner casing must match the OIDC claim (`FabioFiorita`, not
   `fabiofiorita`)** or the token exchange fails. Publishing access may be
   "disallow tokens" — trusted
   publishers still work. Local `npm publish` from a laptop is not the release
   path (passkey 2FA + disallow-tokens); use a version tag.
5. electron-builder uploads to a **draft** release. The workflow pre-creates a single
   draft (`gh release create "$GITHUB_REF_NAME" --draft --generate-notes`, idempotent
   via `gh release view ||`) before `pnpm release:prebuilt` so the dmg and zip uploaders share
   one release — without it each uploader created its own draft and split the assets.
   Open the draft on GitHub, verify the assets and notes, then **Publish** (and "Set
   as latest") so users and the auto-updater can see it. Draft-then-manually-publish
   is by design: electron-updater ignores drafts, so you can verify assets before
   going live. The **npm package publishes immediately** on the tag (not draft);
   provenance is generated automatically under trusted publishing.

   **Agent-tab babysit (do this, not a fire-and-forget monitor).** When the human asks
   you to watch the release CI and mark as latest from the **Agent tab**, the turn is
   headless: it ends when you stop, and background `monitor` tools die with it (v0.39.1
   stayed draft after a "watching… I'll report back" turn). In one turn:

   ```bash
   # block until the workflow finishes (long timeout on the shell tool)
   gh run watch <run-id> --exit-status
   # then publish the draft + set latest in the SAME turn
   gh release edit vX.Y.Z --draft=false --latest
   gh release view vX.Y.Z
   ```

   Prefer `gh run watch` over sleep-polls. Never: start `monitor` / background shell →
   reply "I'll report back" → end the turn. A plain Terminal-tab `grok` TUI *can* park
   on monitors (long-lived process); the Agent tab cannot.
6. **The Linux leg rides the same tag.** `release.yml` also runs a `release-linux`
   job (`ubuntu-latest`, `needs: [release]`) that gates on the full e2e suite under
   `xvfb-run` — no `--ignore-snapshots`, since the `*-linux.png` baselines are now
   committed — then `pnpm release:linux:prebuilt` (= `electron-builder --linux
   --publish always`) uploads the **AppImage**, the **deb**, and `latest-linux.yml`
   into the *same* draft the Mac job pre-created (`needs: [release]` guarantees the
   `gh release create` step already ran, so there's no draft race — electron-builder
   joins the draft by tag). Linux ships **unsigned by decision** (no Apple/CSC
   secrets in this job). **Only the AppImage auto-updates** — `electron-updater`
   consumes `latest-linux.yml` and can replace an AppImage in place, but a **deb has
   no auto-update path**, so `initUpdater()` (`src/main/updater.ts`) returns early on
   Linux unless `$APPIMAGE` is set (else every check would error). The per-main-push
   `linux.yml` CI track is the same sequence minus publishing (it *uploads* the
   AppImage/deb as artifacts); it's where a Linux e2e/baseline regression surfaces
   before you ever tag.

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
`packageManager` is pinned to `pnpm@11.7.0` so `pnpm/action-setup` resolves it.

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

## Electron fuses smoke test (required on every packaged build)

`electron-builder.yml` wires `build/after-pack.js` as an `afterPack` hook that
flips Electron security fuses before signing. It now runs on **linux too** (the
`RunAsNode` fuse guards the daemon fork-bomb on every platform), targeting the
`.app` on mac and the bare Electron binary in `appOutDir` on linux; only genuinely
mac-only steps stay darwin-gated. The standard gate (`pnpm verify`) does NOT
exercise fuses — they only take effect in a packaged build. After every `pnpm
dist`, `pnpm dist:linux`, or release build, verify **all four** before publishing
(the mac commands below have a linux equivalent — e.g. `ELECTRON_RUN_AS_NODE=1
./Porcelain-*.AppImage` for check 3):

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
