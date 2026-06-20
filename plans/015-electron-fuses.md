# Plan 015: Harden the packaged app with Electron Fuses

> **Executor instructions**: Follow step by step. Run every verification command and
> confirm the expected result. This plan changes the **packaging** of a signed,
> notarized app and **cannot be fully verified by the standard `pnpm verify` gate** —
> it requires a packaged build + a manual smoke test (Step 5). If you cannot produce
> a packaged build, STOP after Step 3 and hand off to the maintainer with the diff.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- electron-builder.yml package.json build/`
> If any changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security (defense-in-depth / packaging)
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

The distributed app has **no Electron Fuses** configured, so the signed, notarized
binary still honors `ELECTRON_RUN_AS_NODE` (run the signed app as general-purpose
Node), `ELECTRON_NODE_OPTIONS`, and `--inspect`/`--inspect-brk`, and performs no
embedded-asar integrity validation. Combined with the
`com.apple.security.cs.allow-dyld-environment-variables` entitlement
(`build/entitlements.mac.plist`), this is the standard macOS Electron
post-exploitation surface: a local attacker who can launch the signed binary can
reuse its valid signature/entitlements to run arbitrary Node. Flipping the standard
fuses closes it. This is hardening, not an active exploit, and it must be verified on
a real packaged build because a wrong fuse can break the embedded terminal
(`node-pty`) or the auto-updater.

## Current state

`electron-builder.yml` has no fuses configuration (and `package.json` has no
`@electron/fuses` dependency). The app already: `asarUnpack`s `node_modules/node-pty/**`
(a native addon `pty.node` + a `spawn-helper` binary it execs), ships the updater
(`electron-updater`, `src/main/updater.ts`), `hardenedRuntime: true`, `notarize: true`,
Developer ID identity pinned. The release runbook lives in
`.agents/skills/releasing/SKILL.md`.

Electron-builder runs the `afterPack` hook **before** code signing, so flipping
fuses in `afterPack` and letting electron-builder sign afterward is the correct
order (fuses change the binary; signing must come after).

## The fix

Add `@electron/fuses` (devDependency) and an `afterPack` hook that flips fuses on the
packaged Electron binary. Recommended fuse settings (conservative, node-pty-safe):
- `RunAsNode: false` — disable `ELECTRON_RUN_AS_NODE`.
- `EnableNodeOptionsEnvironmentVariable: false`.
- `EnableNodeCliInspectArguments: false` — disable `--inspect`.
- `OnlyLoadAppFromAsar: true` — load the app bundle only from `app.asar` (does **not**
  block the **unpacked** node-pty native addon, which loads from
  `app.asar.unpacked`; it blocks loading app **JS** from outside the asar).
- `EnableCookieEncryption: true` — low risk, good hygiene.
- **Leave `EnableEmbeddedAsarIntegrityValidation` OFF in the first iteration** — it
  requires the asar header hash to be embedded and can interact with `asarUnpack`;
  enable it only as a deliberate follow-up after the conservative set is proven on a
  packaged build.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Install   | `pnpm install`     | exit 0 |
| Gate      | `pnpm verify`      | all four pass (does NOT exercise fuses) |
| Package (local) | `pnpm dist`  | builds a signed `.dmg`/`.zip` (needs signing env — maintainer machine) |

## Scope

**In scope**:
- `package.json` (+`@electron/fuses` devDependency)
- `electron-builder.yml` (`afterPack: ./build/after-pack.js` or similar)
- `build/after-pack.js` (create — the `flipFuses` hook)

**Out of scope** (do NOT touch):
- `asarUnpack` for node-pty — keep it exactly as is; the terminal depends on it.
- Entitlements / signing identity / notarize config — unchanged.
- `EnableEmbeddedAsarIntegrityValidation` — explicitly deferred (see "The fix").
- The updater code — unchanged; just verify it still works in Step 5.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `chore(security): flip Electron fuses on the packaged app`.
- Do NOT push unless instructed. Do NOT cut a release as part of this plan.

## Steps

### Step 1: Add `@electron/fuses`

`pnpm add -D @electron/fuses`. **Verify**: it appears in `devDependencies`.

### Step 2: Write the `afterPack` hook

Create `build/after-pack.js` (CommonJS, electron-builder loads it as a Node module):
```js
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')
const path = require('node:path')

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return
  const app = path.join(appOutDir, `${context.packager.appInfo.productFilename}.app`)
  await flipFuses(app, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.EnableCookieEncryption]: true,
    // EnableEmbeddedAsarIntegrityValidation deliberately omitted in this iteration.
  })
}
```
Confirm the exact path to the `.app` for this electron-builder version (the
`productFilename` is `Porcelain`); adjust if the build output differs.

### Step 3: Point electron-builder at the hook

In `electron-builder.yml`, add `afterPack: build/after-pack.js`.

**Verify**: `pnpm install && pnpm verify` → the standard gate still passes (it does
NOT package, so this only confirms nothing else broke).

### Step 4: STOP-or-continue gate

If you (the executor) **cannot** run a signing-capable packaged build, STOP here and
hand the diff to the maintainer with this note: "Fuses wired; needs a packaged smoke
test (Step 5) on a signing-capable machine before merge." Do NOT mark the plan DONE
without Step 5.

### Step 5: Packaged smoke test (maintainer / signing-capable machine)

Run `pnpm dist` to produce the signed `.dmg`/`.zip`. Install and launch the packaged
app, then verify **both** fuse-sensitive paths still work:
- **Embedded terminal**: open a terminal tab; a PTY spawns and runs a command
  (proves the unpacked, signed `node-pty` + `spawn-helper` still load under
  `OnlyLoadAppFromAsar`).
- **Updater**: confirm the app launches without an update-check crash (the updater
  runs on launch; a fuse-related failure would surface in the main log).
Optionally confirm a fuse took effect: `ELECTRON_RUN_AS_NODE=1 open -a Porcelain`
should NOT run as Node.

## Test plan

- The standard gate (`pnpm verify`) only proves the build config parses and nothing
  else regressed — it does **not** test fuses. The real test is the **packaged smoke
  test** (Step 5): terminal spawns + updater works + `RunAsNode` disabled.
- There is no unit test for packaging; this is verified by the packaged build, as the
  `releasing` skill describes for signing/notarization.

## Done criteria

ALL must hold:

- [ ] `@electron/fuses` is a devDependency; `build/after-pack.js` flips the
      conservative fuse set; `electron-builder.yml` references the hook
- [ ] `pnpm verify` passes
- [ ] **Step 5 completed**: a packaged build launches, the embedded terminal spawns a
      PTY, and the updater doesn't crash on launch (record the result in the PR)
- [ ] `EnableEmbeddedAsarIntegrityValidation` was NOT enabled in this iteration
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The packaged terminal fails to spawn a PTY after flipping fuses (`OnlyLoadAppFromAsar`
  interacting with the unpacked node-pty) — report; do not ship a build with a broken
  terminal. Consider dropping `OnlyLoadAppFromAsar` and keeping only the RunAsNode/
  NodeOptions/inspect fuses.
- The updater crashes or notarization is rejected — report the exact failure.
- You cannot produce a signed build — STOP at Step 4 and hand off (do not guess that
  it works).

## Maintenance notes

- Fold the fuse smoke checks (terminal spawns, updater OK) into the release runbook in
  `.agents/skills/releasing/SKILL.md` so every future release re-verifies them.
- `EnableEmbeddedAsarIntegrityValidation` is the natural follow-up once the
  conservative set is proven — it adds asar tamper-detection but needs the header hash
  embedded; do it as its own change with its own packaged smoke test.
- If `node-pty` is ever updated or a second native module is added, re-run the Step 5
  smoke test — fuses interact with native-addon loading.
