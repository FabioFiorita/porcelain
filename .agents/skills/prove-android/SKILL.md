---
name: prove-android
version: 0.57.1
metadata:
  internal: true
description: Drive the Android emulator to observe a change in the mobile client — Metro, a dev client on the AVD, then semantic tap/screenshot through `scripts/mobile-android-loop.sh`. Use when the changed behavior is `apps/mobile` and Android is the surface, or when mobile evidence is asked for and no iOS device is required. Read `docs/runtime-proof.md` for what finishes a proof.
---

# Prove android

The emulator is the cheaper mobile surface on Linux — it runs headless on this machine, where iOS
needs a Mac. `scripts/mobile-android-loop.sh` is the driver; its header comments list every command
and environment input, so read the script rather than a copy of it here.

## The loop

```sh
pnpm dev:mobile                                      # profile Metro, background
pnpm dev:mobile:android preflight                    # package, Metro, emulator, foreground app
pnpm dev:mobile:android up                           # boot/reuse AVD, reverse Metro, launch client
pnpm dev:mobile:android ui                           # visible testIDs, labels, bounds, actions
pnpm dev:mobile:android tap <testID-or-label>
pnpm dev:mobile:android shot /tmp/porcelain-android.png
pnpm dev:mobile:android fg
pnpm dev:mobile:android down                         # release only this loop's resources
```

A first launch after an install lands on the development-client onboarding, then its dev menu. Both
are plain React Native text that the tree reports as non-clickable, so `tap Continue` refuses by
design: take the coordinates `ui` printed for that row with `$S xy <x> <y>`, then `$S key BACK` to
leave the menu. From there every Porcelain control carries a `porcelain-phone-*` testID and `tap`
works on the name.

Resolve every control from `ui` output — the script prefers React Native `testID` values and
accessibility labels, and `xy` coordinates are the last resort, never a reading off a screenshot.
Refresh the tree after navigation or a keyboard change.

## The dev client has to be there first

`up` deep-links `porcelain-dev://` into an installed development build. A cold-booted AVD that
never saved a snapshot has none, and `up` then leaves the launcher in the foreground with nothing
in the log to say why. Install one and let it install to the running emulator:

```sh
APP_VARIANT=development pnpm --dir apps/mobile android:build   # local Gradle build, ~6 min cold
```

Reinstall when the native fingerprint moves; `eas fingerprint:compare` answers that, and a
JavaScript-only change needs nothing but Metro.

## Traps

- **`CI=1` freezes the bundle.** `expo start` under that flag serves one frozen bundle forever and
  the watcher never fires, so every edit you make is invisible and you debug ghosts.
- **Use the profile wrappers.** They derive a Metro port and temporary directory from the current
  checkout, so main and managed worktrees do not share Metro process state. `adb logcat -b crash`
  carries the real error whenever the app dies at launch.
- **Export `ANDROID_HOME`.** `~/Android/Sdk` here; `adb` and `emulator` live under it.
- **An emulator you did not boot belongs to someone else.** Run `adb devices` before `up`, and let
  `down` stop only the one this loop booted.

## Down

`pnpm dev:mobile:android down` removes this loop's Metro reverse and stops only its own emulator. Stop the Metro you
started by its tracked task or PID.

Ownership is recorded when `up` prints `launched …`. An `up` that was interrupted before that line
booted an emulator it never claimed, so a later `down` reports it as pre-existing and leaves it
running: check `adb devices` and stop that one yourself with `adb -s <serial> emu kill`.
