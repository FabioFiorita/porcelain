---
name: prove-android
version: 0.60.1
metadata:
  internal: true
description: Drive the Android emulator to observe a change in the mobile client — Metro, a dev client on the AVD, then semantic tap/screenshot through `scripts/mobile-android-loop.sh`. Use when the changed behavior is `apps/mobile` and Android is the surface, or when mobile evidence is asked for and no iOS device is required. Read `docs/runtime-proof.md` for what finishes a proof.
---

# Prove android

The emulator is the cheaper mobile surface on Linux — it runs headless on this machine, where iOS
needs a Mac. `scripts/mobile-android-loop.sh` is the driver; its header comments list every command
and environment input, so read the script rather than a copy of it here.

## Device boundary

This machine has two personal AVDs for Android proof: `phone` and `tablet`. Run exactly one at a
time, and select the form factor explicitly when it matters:

```sh
ANDROID_LOOP_AVD=phone pnpm dev:mobile:android up
ANDROID_LOOP_AVD=tablet pnpm dev:mobile:android up
```

Do not create or use another AVD name. The personal profile owns the adb server on
`127.0.0.1:5037`; never run `adb kill-server`, because another profile may be using that server.
The mutating loop commands take `/tmp/android-device-lock/device.lock` so only one run drives the device at a
time. A second profile participating in the same device workflow must be configured to use this
same lock path; the lock is host-wide, not per-user.

## The loop

```sh
pnpm dev:mobile                                      # profile Metro, background
pnpm dev:mobile:android preflight                    # package, Metro, emulator, foreground app
ANDROID_LOOP_AVD=phone pnpm dev:mobile:android up   # boot/reuse one AVD, reverse Metro, launch client
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

## Windowed mode, when the human wants to watch

`up` is headless by default — no window renders, which keeps agent-driven runs fast and
deterministic. When the human asks to see the emulator or wants to click into it themselves, boot
with a window instead:

```sh
ANDROID_LOOP_WINDOW=1 pnpm dev:mobile:android up
```

This machine's desktop runs under XWayland, where the emulator's Qt UI is known to freeze on click
until the window loses and regains focus. The script now exports `QT_QPA_PLATFORM=xcb`
automatically whenever `ANDROID_LOOP_WINDOW=1` is set, which avoids that — no extra step needed.
A window can't be attached to an already-running headless instance; `down` it and `up` again with
the flag set. Go back to plain `up` (no `ANDROID_LOOP_WINDOW`) once the human is done watching.

## The dev client has to be there first

`up` deep-links `porcelain-dev://` into an installed development build. A cold-booted AVD that
never saved a snapshot has none, and `up` then leaves the launcher in the foreground with nothing
in the log to say why. Install one and let it install to the running emulator. These commands build
Porcelain's own development client; they belong to this project and are separate from SOAP Health's
build/Metro workflow:

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
- **Keep the device set small.** Use only `phone` or `tablet`, and never run both at once. If no
  device is ready, ask the personal profile to start one.
- **Do not kill adb.** Never run `adb kill-server`; the adb server is shared across profiles.
- **Do not delete the device lock.** `/tmp/android-device-lock/device.lock` is a live `flock` lock, not an AVD
  stale-lock file.
- **An emulator you did not boot belongs to someone else.** Run `adb devices` before `up`, and let
  `down` stop only the one this loop booted.
- **Stale locks self-heal.** An emulator killed ungracefully (crashed session, host restart) can
  leave `hardware-qemu.ini.lock`/`multiinstance.lock` behind, which made the next boot fail in a
  different way each time. `boot_emulator` now clears an AVD's stale locks itself once `adb` shows
  no live serial for it — no manual cleanup needed on a fresh boot failure.

## Down

`pnpm dev:mobile:android down` removes this loop's Metro reverse and stops only its own emulator. Stop the Metro you
started by its tracked task or PID.

Ownership is recorded when `up` prints `launched …`. An `up` that was interrupted before that line
booted an emulator it never claimed, so a later `down` reports it as pre-existing and leaves it
running: check `adb devices` and stop that one yourself with `adb -s <serial> emu kill`.
