---
name: mobile
version: 0.53.2
metadata:
  internal: true
description: Fingerprint-gated iOS and Android build, install, deliver, and proof loop for apps/mobile, including semantic Android emulator control through stable React Native testIDs, accessibility labels, adb, and uiautomator. Load when building, installing, delivering, or taking mobile runtime evidence — not for every mobile file edit.
---

# Mobile runbook

Platform law lives in `apps/mobile/AGENTS.md`. This skill is the loop and the traps.

Host topology (Linux Metro, Mac sim/serve-sim, local builds over EAS) is in
`apps/mobile/AGENTS.local.md` when present.

## The fork: did the fingerprint move?

```bash
eas fingerprint:compare
```

| | Fingerprint **unchanged** | Fingerprint **moved** |
|---|---|---|
| **Simulator / emulator** | Metro Fast Refresh | Local native build + install on the matching host; EAS if unavailable |
| **Phone** | `eas update` (free) | EAS workflow for iOS; local Android build for development |

Most sessions are the top-left cell. Prefer local Mac builds for native sim work to protect quota.

## Traps worth keeping

- **`--local` install pairs with `sim:install:local --path`.** Plain `sim:install` pulls the latest
  *EAS* artifact and can silently install an older cloud build after a local compile.
- **Pass `--simulator` by exact name** from `xcrun simctl list devices` — omit and it may hit the
  wrong booted device.
- **`development-simulator` profile** is required for unsigned arm64 `.app`; plain `development` is a
  device `.ipa`.
- **`eas update` is a silent no-op** if the fingerprint moved (publishes a runtime no installed build
  carries). Compare first.
- **Workflows are `workflow_dispatch` only** — `pnpm lint` fails automatic triggers (`lint-eas-triggers`).
- Delivery uses `type: submit`, not paid-tier `testflight` with a `build_id`.
- **Two apps on device:** Porcelain Dev vs Porcelain (bundle id / icon via `APP_VARIANT`). Register
  physical devices before ad-hoc builds.

## Layout (when changing screens)

```
src/app/        routes only
src/features/   one folder per feature
src/lib/daemon/ only daemon seam — no AppRouter import, no barrels
```

iPhone and Android phone = **four** bottom tabs (Files · Changes · Terminal · Settings);
History / Search are **re-tap dual faces** (store, not URL); Companion is a sheet from the bolt.
The daemon-root Review Canvas is currently a Web/Desktop surface; mobile's shell does not expose a
repo-local Review or Board route. Tablet (iPad + Android) = primary · supplementary · viewer ·
companion (`features/shell`);
Settings is a sheet on tablet, a tab on phone. iOS uses root `SplitView` + inspector; Android tablet
uses the shared multi-column shell. Full IA: `reference/client.md`.

## Android control

Use [`reference/android.md`](reference/android.md) and its executable
[`scripts/android-loop.sh`](scripts/android-loop.sh) for Android runtime proof. Prefer exact
React Native `testID` resource IDs, then stable accessibility labels/text, then deep links or
explicit gesture fallbacks. The loop refreshes `uiautomator` before actions, refuses ambiguous
targets, derives tap coordinates from the live tree, and tracks emulator ownership so it does not
stop a device started by someone else.

## Reference

| File | When |
|---|---|
| `reference/loop.md` | Build, install, update, TestFlight, costs |
| `reference/client.md` | Screens, tabs, daemon seam, file layout |
| `reference/android.md` | Android emulator control, testID contract, and evidence traps |
