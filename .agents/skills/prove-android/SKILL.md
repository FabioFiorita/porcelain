---
name: prove-android
version: 0.61.1
metadata:
  internal: true
description: Drive the Android emulator to observe a change in the mobile client — Metro, a dev client on the AVD, then semantic tap/screenshot through `scripts/mobile-android-loop.sh`. Use when the changed behavior is `apps/mobile` and Android is the surface, or when mobile evidence is asked for and no iOS device is required. Read `docs/runtime-proof.md` for what finishes a proof.
---

# Prove android

The emulator is the cheaper mobile surface on Linux — it runs headless on this machine, where iOS
needs a Mac. `scripts/mobile-android-loop.sh` is the driver; its header comments list every command
and environment input, so read the script rather than a copy of it here.

## Machine boundary

Keep machine-owned SDK paths, AVD names, serial selection, and emulator ownership out of this
skill. Put them in a developer-owned environment file and pass that file on every loop call;
shell state does not carry from one command invocation to the next:

```sh
ANDROID_LOOP_ENV_FILE=/path/to/android-loop-env.sh pnpm dev:mobile:android preflight
```

A machine that owns its AVD can set `ANDROID_LOOP_AVD`. An account attaching to an emulator owned
by another account or session must set `ANDROID_LOOP_NO_BOOT=1` and may pin
`ANDROID_LOOP_SERIAL`. More specialized hosts can supply `ANDROID_LOOP_UP_CMD` and
`ANDROID_LOOP_DOWN_CMD`; these are the only bring-up and teardown seams. Do not copy private
machine paths or credentials into the repository.

The adb server and emulator may be shared. Never run `adb kill-server`. Mutating loop commands
take `/tmp/android-device-lock/device.lock`, so every account or project driving the same host must
use that host-wide lock path. Run one proof flow at a time even when several AVDs exist; when more
than one serial is ready, pin the intended one explicitly.

## The loop

```sh
pnpm dev:mobile                                                        # profile Metro, background
ANDROID_LOOP_ENV_FILE=$ANDROID_ENV pnpm dev:mobile:android preflight   # always inspect first
ANDROID_LOOP_ENV_FILE=$ANDROID_ENV pnpm dev:mobile:android up          # boot/attach, reverse, launch
ANDROID_LOOP_ENV_FILE=$ANDROID_ENV pnpm dev:mobile:android ui          # semantic controls and bounds
ANDROID_LOOP_ENV_FILE=$ANDROID_ENV pnpm dev:mobile:android tap <testID-or-label>
ANDROID_LOOP_ENV_FILE=$ANDROID_ENV pnpm dev:mobile:android shot /tmp/porcelain-android.png
ANDROID_LOOP_ENV_FILE=$ANDROID_ENV pnpm dev:mobile:android rec /tmp/porcelain-android.mp4 20
ANDROID_LOOP_ENV_FILE=$ANDROID_ENV pnpm dev:mobile:android fg
ANDROID_LOOP_ENV_FILE=$ANDROID_ENV pnpm dev:mobile:android down        # release only owned resources
```

`ANDROID_ENV` above is a task-local shell variable naming the machine environment file. Set it in
each shell that runs the commands, or use the literal path each time.

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
ANDROID_LOOP_ENV_FILE=$ANDROID_ENV ANDROID_LOOP_WINDOW=1 pnpm dev:mobile:android up
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
- **Pass the machine environment every time.** It should export `ANDROID_HOME`, extend `PATH` for
  `adb` and `emulator`, and describe ownership. An attach-only account should ask the owning
  account or session to start the AVD when preflight reports none.
- **Headless uses ANGLE software rendering.** The default is `-gpu swangle_indirect`; legacy
  SwiftShader GLES can segfault. Keep host-specific emulator flags in the environment file.
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

`ANDROID_LOOP_ENV_FILE=$ANDROID_ENV pnpm dev:mobile:android down` removes this loop's Metro reverse
and stops only an emulator this loop brought up. Stop the Metro you started by its tracked task or
PID. `down --force` is reserved for an explicitly identified emulator that the human has authorized
this task to stop; it is not routine cleanup.

Ownership is recorded when `up` prints `launched …`. An `up` that was interrupted before that line
booted an emulator it never claimed, so a later `down` reports it as pre-existing and leaves it
running. Resolve the exact serial and ownership before using forced teardown.
