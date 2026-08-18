---
name: mobile
metadata:
  internal: true
description: Build, install, deliver, and prove apps/mobile on iOS or Android. Load for native builds, device or simulator installs, EAS delivery, emulator control, or mobile runtime evidence; ordinary mobile edits follow the shared development loop.
---

# Mobile

Read `docs/development.md` for the shared development loop, worktree setup, daemon and
Playground rules, and host-specific setup. This skill owns only the mobile branches that need
native tooling or runtime evidence. For source changes, follow the root instructions and the
patterns in the owning mobile module.

## Choose the proof path

Before building or delivering, compare the native fingerprint:

```bash
eas fingerprint:compare
```

| Fingerprint | Simulator / emulator | Phone |
|---|---|---|
| Unchanged | Metro Fast Refresh | `eas update` |
| Moved | Local native build on the matching host, or EAS when local tooling is unavailable | EAS workflow for iOS; local Android build for development |

Pure TypeScript, JavaScript, and CSS changes normally stay on Fast Refresh. A dependency, Expo
config, native module, SDK, or device-family change needs a new binary. A successful `eas update`
does not reach an installed binary whose runtime fingerprint moved.

## Native build traps

- Prefer a local Mac simulator build when a Mac is available; use EAS cloud builds when local
  tooling is unavailable or an installable device/TestFlight artifact is needed.
- Pair a local build with the local installer (`sim:install:local --path <artifact>`), not the
  EAS downloader, or an older cloud artifact can silently replace it.
- Pass the exact simulator name from `xcrun simctl list devices`.
- Use the `development-simulator` profile for an unsigned simulator `.app`; the plain
  `development` profile produces a device `.ipa`.
- Register physical devices before an ad-hoc build.
- Keep Porcelain Dev and the production/TestFlight app side by side; do not mistake one for the
  other.

For the concrete iOS and EAS commands, read [reference/loop.md](reference/loop.md). Load the
ignored `apps/mobile/AGENTS.local.md` only when the current machine's simulator, Metro, SSH, or
serve-sim setup is part of the proof.

## Android runtime proof

Use [reference/android.md](reference/android.md) and the bundled
`scripts/android-loop.sh`. Before `up`, check emulator ownership with `adb devices`; boot and
address a session-owned emulator when another task already owns the visible one. Target stable
React Native `testID`s and accessibility labels through the live `uiautomator` tree. Refresh the
tree after navigation or keyboard changes, and tear down only emulators this session started.

Runtime evidence means reading the foreground package, inspecting the final screen, and checking
the changed behavior. A successful build or tap command is not evidence by itself. Keep daemon
credentials and pairing tokens out of screenshots and logs.

## Completion

For a mobile task, leave one of these proofs:

- Fast Refresh plus a focused test or typecheck for a JS-only change.
- A matching native build and install for a fingerprint change.
- Device or simulator interaction for a runtime-visible change.
- EAS workflow output for a delivery request.

Run only the checks the affected mobile behavior needs during iteration. Use the repository's full
verification command when the task or release procedure explicitly calls for it.
