---
name: mobile
metadata:
  internal: true
description: Fingerprint-gated iOS build, install, deliver, and proof loop for apps/mobile. Load when building, installing, delivering, or taking mobile runtime evidence — not for every mobile file edit.
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
| **Simulator** | Metro Fast Refresh | Mac **local** build + install (free); cloud only if Mac toolchain unavailable |
| **Phone** | `eas update` (free) | EAS workflow — spends one of **15** monthly iOS builds |

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

iPhone = **four** bottom tabs (Files · Changes · Review · Terminal); History/Board are pushes +
re-tap alternates; Settings/Companion are sheets. iPad = root `SplitView` + inspector, no tab bar.
iOS 26+. Full IA: `reference/client.md`.

## Reference

| File | When |
|---|---|
| `reference/loop.md` | Build, install, update, TestFlight, costs |
| `reference/client.md` | Screens, tabs, daemon seam, file layout |
| `reference/expo.md` | Expo Router / SwiftUI / SDK traps vs generic Expo docs |
