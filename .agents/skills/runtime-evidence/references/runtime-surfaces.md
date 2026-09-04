# Run and verify each surface

These procedures select current repository commands; they are not a record that any command or
surface passed. Record actual results in the task manifest. Read
[development.md](../../../../docs/development.md), [package scripts](../../../../package.json), and
the relevant launcher before use. Resolve allocations with `pnpm dev:env` in the chosen checkout.

## Browser and Electron

1. Choose the daemon owner. `pnpm dev` launches Electron with its development daemon. If Electron
   is not running, `pnpm dev:daemon` can own that profile instead. Never run both owners together.
   Record their process IDs and verify the daemon belongs to the intended profile.
2. For web hot reload, run `pnpm dev:web` and open its printed development URL. Alternatively open
   the daemon's printed browser URL to inspect built web assets. Authenticate new clients through
   `pnpm dev:pair`; keep its one-time URL out of evidence and screenshots.
3. Open a disposable fixture and confirm the Environment and path on each client. Observe native
   Electron through native Windows controls, even when browser and Electron share renderer code.
4. Match refresh to the changed owner: hot-reload web source through `dev:web`; run `pnpm build:web`
   for daemon-served web assets; run `pnpm build:daemon` and restart the owned daemon for daemon
   changes; run `pnpm build` and restart Electron for desktop main/preload changes. Coordinate a
   daemon restart with its browser/mobile clients and verify reconnection before collecting proof.

A listening port establishes transport availability, not readiness. The fixture must load in the
actual application and the tested behavior must run against the intended source/build. Record
loading, connection, and rendering failures separately so an old window cannot count as new proof.

## Android on Windows

The [mobile launcher](../../../../scripts/mobile-dev.mjs) owns `APP_VARIANT=development` and the
profile's Metro port. Use `pnpm dev:mobile` with the existing verified daemon. Its Windows path
invokes `pnpm.cmd` through `cmd.exe` and runs Expo through `pnpm exec`; do not work around launch
failures by silently switching to WSL or a different profile. Record the command/error if it fails.

Inventory phone and tablet AVDs with `emulator -list-avds`. Run one emulator at a time by default:
capture the phone's result, close the task-owned phone, then start the tablet. Concurrent emulators
need a concrete task reason and separate available console ports. On Windows, launch an owned
AVD with `Start-Process` and
`-WindowStyle Hidden`; record its PID and the serial actually reported by `adb devices -l`.
Complete the checks below for both form factors. They may share the verified Metro and daemon,
but each needs its own forwarding, development-client installation, pairing, and native evidence.
Check its ABI before reusing an APK. Include portrait/landscape when the changed layout depends
on orientation; do not treat a resized browser viewport as native tablet proof.

1. Inventory devices with `adb devices -l`, select the intended serial, and use `adb -s <serial>`
   for every device operation. Check `shell getprop sys.boot_completed`; an attached device can
   still be booting. Record whether the emulator is borrowed or task-owned before installing or
   changing its application state.
2. Start the profile's Metro and check `http://127.0.0.1:<metro-port>/status`. Confirm its process
   and checkout, then wait for the app's bundle to load successfully. A healthy Metro status does
   not establish that JavaScript compiled or that required native modules are installed.
3. Inspect existing forwarding with `adb -s <serial> reverse --list`. For a client using host
   loopback, map `adb -s <serial> reverse tcp:<metro-port> tcp:<metro-port>`. Use the resolved port,
   record whether the mapping was already present, and do not overwrite another task's routing.
   Metro connectivity and daemon connectivity are separate: pair using a route the device can
   reach. If daemon loopback also needs a reverse mapping, record and own that exact mapping too.
4. Open the installed development client against this Metro URL. Resolve its current application
   identity and scheme from [app.config.ts](../../../../apps/mobile/app.config.ts), rather than
   assuming an installed production app is suitable. The
   [Android helper](../../../../scripts/mobile-android-loop.sh) shows config discovery and dev-client
   launch behavior, but its Bash dependencies make it unsuitable as a native PowerShell launcher.
5. Pair with `pnpm dev:pair`, verify the intended daemon Environment, and open the disposable
   fixture. Confirm the actual native screen has loaded before calling Android ready. Exclude the
   pairing screen, tokens, and credential-bearing deep links from shared captures and logs.

### JavaScript refresh versus native rebuild

JavaScript/TypeScript changes can be served by Metro when the installed development binary has
all required native capabilities. Changes to native modules, Expo plugins/configuration, or the
native dependency set require a development-client rebuild and install. A missing native module
such as `ExpoCamera` is not fixed by repeated JavaScript reloads or a successful Metro status.

For native Windows builds, use a dedicated PowerShell process with the installed JDK and Android
SDK. Set `$sdkRoot`, `$serial`, `$metroPort`, and `$nativeStage` from the verified SDK, selected
device, profile allocation, and an empty task-owned short staging directory. Set `$ninjaPath` to a
verified task-local Ninja executable as described below. Do not reuse another checkout's staging
directory. Run from the repository root:

```powershell
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:APP_VARIANT = 'development'
$env:NODE_ENV = 'development'
$env:METRO_PORT = [string]$metroPort
$env:RCT_METRO_PORT = [string]$metroPort
$env:PORCELAIN_NATIVE_BUILD_DIR = $nativeStage
$env:PORCELAIN_NINJA_PATH = $ninjaPath
$adb = Join-Path $sdkRoot 'platform-tools/adb.exe'
$abi = (& $adb -s $serial shell getprop ro.product.cpu.abi).Trim()
pnpm --dir apps/mobile exec expo prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw 'Android prebuild failed' }
Push-Location apps/mobile/android
try {
  ./gradlew.bat :app:assembleDebug "-PreactNativeArchitectures=$abi" "-PreactNativeDevServerPort=$metroPort" --max-workers=2 --console=plain -I ../../../.agents/skills/runtime-evidence/scripts/android-native.init.gradle
  if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
} finally { Pop-Location }
```

The [Gradle helper](../scripts/android-native.init.gradle) uses short CMake staging and invokes
[source alias preparation](../scripts/android-native-paths.mjs) after every autolinking generation.
It creates junctions to whole package roots, preserving relative native source paths, and rewrites
only generated CMake input. Ownership and alias targets are recorded in the staging directory;
unexpected generated formats or conflicting junctions fail visibly. No source is moved and no
machine registry or SDK binary is changed. Keep staging while its generated build inputs are used.

Long pnpm paths can cause Ninja regeneration loops or `Filename longer than 260 characters`.
Short staging alone does not shorten generated source paths; use the helper's package aliases too.
If selecting a newer Ninja, obtain a Windows binary from the
[official Ninja releases](https://github.com/ninja-build/ninja/releases), verify its published asset
digest, keep it under a task-owned tools directory, and set `PORCELAIN_NINJA_PATH` to that executable.
Ninja 1.13.2 was used with this procedure; upgrading Ninja alone does not override Windows long-path
policy. Do not replace the SDK's bundled Ninja. For a remaining regeneration loop, inspect
`ninja -d explain -n` in the failing staging directory before treating warnings as its cause.

Coordinate with the device operator before installation, then record the APK hash and install
without clearing application data or launching another Metro:

```powershell
$apk = 'apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk'
Get-FileHash $apk -Algorithm SHA256
& $adb -s $serial install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'Android install failed' }
```

Preserve the existing Metro/emulator owner. Package-local scripts use POSIX environment-prefix
syntax; the commands above supply the variant through process environment instead. Close the
dedicated PowerShell process afterward to discard its temporary environment settings.

Record build result, installed binary provenance, selected device, bundle connection, and observed
application readiness separately. Restore any temporary shell environment changes afterward.
Once the rebuilt client opens, repeat pairing/fixture checks; compilation and installation alone
are not native runtime proof.

## Capture and release

For Android, `adb -s <serial> shell uiautomator dump <task-owned-device-path>` supplies native
control bounds. Refresh it after navigation; screenshots establish rendered content that may not
appear in the hierarchy. Capture the device directly when desktop windows obscure the emulator.
Preserve screenshot bytes rather than passing them through a text pipeline. With `$adb`, `$serial`,
and an absolute `$capturePath` already selected, this writes a PNG without shell encoding changes:

```powershell
node --input-type=module -e 'import {execFileSync} from "node:child_process"; import {writeFileSync} from "node:fs"; writeFileSync(process.argv[3], execFileSync(process.argv[1], ["-s", process.argv[2], "exec-out", "screencap", "-p"]));' $adb $serial $capturePath
```

Inspect the resulting image. Avoid dumping or capturing credential-entry screens. For Electron,
save the native Computer Use screenshot; for web, save the browser tool's screenshot bytes. Match
the file extension to the returned encoding. A device capture proves Android rendering; it does
not prove Windows window management or Electron behavior.

Use the entrypoint's evidence manifest and one-operator rule. Record source/build identity beside
screenshots or video, with expected and observed behavior. Check captures for credentials before
sharing. On completion, remove only reverse mappings created by this task with
`adb -s <serial> reverse --remove tcp:<owned-port>`, stop task-owned Metro/processes, and preserve
borrowed devices. Hand off any retained client, fixture, and daemon state explicitly.
