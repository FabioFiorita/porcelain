# Android

Select the Android device needed for the task. Reuse a compatible development app when available,
start Metro with the project's mobile launcher, and connect the app to the intended development
Environment. Rebuild the native app only when required by native changes or a missing compatible
build.

Follow commands appropriate to the host operating system and target the selected device explicitly.

## Android on Windows

Run `pnpm dev:mobile` to start Metro with the checkout's development configuration. Use the
existing development daemon or start one through the development launcher.

Use `adb devices -l` to identify connected devices and `emulator -list-avds` to list available
emulators. Select one device unless the task requires more. Use its serial explicitly for device
commands.

On Windows, launch an owned AVD with `Start-Process -WindowStyle Hidden`; record its PID and the
serial reported by `adb devices -l`.

Wait for the selected device to finish booting. Open the development app against the checkout's
Metro server, configure device forwarding only when needed, and pair through `pnpm dev:pair`.
Confirm the task's test project loads before checking its behavior.

- Check boot completion with `adb -s <serial> shell getprop sys.boot_completed`.
- Inspect forwarding with `adb -s <serial> reverse --list`.
- For host-loopback Metro access, use
  `adb -s <serial> reverse tcp:<metro-port> tcp:<metro-port>` with the checkout's resolved port.
  If daemon access also needs forwarding, use the same command with its port. Preserve other
  tasks' mappings and track mappings created here for cleanup.

Resolve the development app identity and scheme from
[app.config.ts](../../../../apps/mobile/app.config.ts). Use `pnpm dev:mobile:android phone` or
`tablet` to open the selected AVD against this checkout's Metro and daemon. The
[launcher](../../../../scripts/android/launch.mjs) supports Windows, macOS, and Linux.

### JavaScript refresh versus native rebuild

Reuse the development app for JavaScript and TypeScript changes. Rebuild when native code,
dependencies, or configuration change, or when no compatible development app is installed.

Build for the selected connected device with the installed JDK and Android SDK:

```sh
pnpm dev:mobile:android build --device <serial>
```

The [build command](../../../../scripts/android/build.mjs) uses the checkout's Metro port and
the device's architecture. On Windows it applies the native path helpers with checkout-specific
temporary staging. Set `PORCELAIN_NATIVE_BUILD_DIR` for a custom short staging path or
`PORCELAIN_NINJA_PATH` for a verified alternate Ninja executable when needed. Keep staging while
its generated build inputs are in use.

The command prints the APK path. Install it on the selected device with
`adb -s <serial> install -r <apk-path>`, preserving application data and the existing Metro owner.
Then open the app and repeat the connection and fixture checks. A successful build and installation
do not establish application readiness.

## Interaction and capture

Follow the [main skill](../SKILL.md) for interaction, reporting, and cleanup guidance.

Use `adb -s <serial> shell uiautomator dump <task-owned-device-path>` to inspect the native UI
hierarchy when supported by the selected device and tooling.

React Native test IDs appear as `resource-id` in this hierarchy. With adb-only tooling, resolve
the requested ID in a fresh dump and tap inside its current bounds using
`adb -s <serial> shell input tap <x> <y>`. Check the resulting hierarchy; a successful tap command
does not establish that the intended control received it. Expo's floating Tools button can
overlap header controls. Dismiss its menu with Android Back and use an unobscured part of the
target when necessary.

On a phone, open a Worktree, then its Files surface. On a tablet, use the Worktrees sidebar and
Files panel beside the viewer. Check the actual layout rather than reusing phone coordinates.

For a new connection, paste a fresh `pnpm dev:pair` link into Settings > Remotes > Create environment
group and choose Create & use. Replace existing field contents before entering another link;
the field masks credentials. Confirm Connected, then open a disposable project's file. Reuse an
existing suitable connection instead of pairing again.

Preserve screenshot bytes rather than passing them through a text pipeline. With `$adb`, `$serial`,
and an absolute `$capturePath` already selected, this writes a PNG without shell encoding changes:

```powershell
node --input-type=module -e 'import {execFileSync} from "node:child_process"; import {writeFileSync} from "node:fs"; writeFileSync(process.argv[3], execFileSync(process.argv[1], ["-s", process.argv[2], "exec-out", "screencap", "-p"]));' $adb $serial $capturePath
```

Inspect saved screenshots. When cleaning up, remove only forwarding created by the task with
`adb -s <serial> reverse --remove tcp:<owned-port>`.
