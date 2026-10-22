# Android development on Linux

The mobile launcher builds and runs Porcelain Dev locally on Linux or macOS. No Mac, Apple tools, Expo login or EAS build is needed. It uses the same disposable server, fixture, pairing, Metro, evidence and cleanup owners as iOS.

## Prepare your machine

Install the repository's Node and pnpm versions and run `pnpm install`. Install Android Studio with its SDK, platform-tools, emulator and a system image; set `ANDROID_HOME` to your SDK directory and add `$ANDROID_HOME/platform-tools` to `PATH`. Install JDK 17 or newer (the Linux proof used JDK 21), compatible with the generated Android Gradle plugin and set `JAVA_HOME` when Java is not already on your path. SDK Manager supplies missing SDK platforms, build-tools, NDK and CMake versions reported by the build; accept SDK licenses there. The first build downloads Gradle and native dependencies and can take several minutes.

The development build selects one host-native emulator ABI: x86_64 on an x64 host, arm64-v8a on an arm64 host; other host architectures are refused. Use an emulator matching the host: startup checks its primary ABI before installing or clearing app data. The launcher keeps Gradle at two workers, a 2 GiB heap, 1 GiB maximum metaspace and in-process Kotlin compilation. Gradle's worker limit alone does not limit Ninja. A build-only Gradle init script configures every Android app/library project's CMake compile and link jobs to share a two-job Ninja pool, allowing at most four concurrent native compiler/link jobs across the two Gradle workers. Release builds are unaffected.

On Linux, `build --device android` checks `/proc/meminfo` before Expo prebuild or Gradle starts. It requires 8 GiB of **available** RAM (swap does not count), separately from the 4 GiB floor for starting a disposable verification instance. On the 26 GiB Linux verification host, a clean native build peaked at 5.42 GiB of aggregate build-process RSS with four compilers, leaving about 2.58 GiB of margin at that floor. Insufficient or unreadable available memory causes a refusal explaining the build budget and how to recover; wait or stop a process you own, then retry. This check observes available memory; it does not reserve it against other work. macOS does not have `/proc/meminfo` and keeps its existing startup policy.

Create an emulator once in Android Studio's Device Manager. Boot it there or open it with T3 `device_list` → `device_open`, then use `adb devices -l` to read its serial. Verification never creates, deletes or silently chooses a device. Only an explicit, booted local emulator is accepted; physical devices are refused because each start clears Porcelain Dev's app data. Preview and production package identities remain separate.

Developer-specific tools and selections belong in the ignored `.mobile-device-host.json` in the main checkout, shared by worktrees:

```json
{
  "agentDevice": "/absolute/path/to/agent-device",
  "androidSerial": "emulator-PORT"
}
```

Replace the placeholders with your own executable and the numeric emulator serial from `adb devices -l`. Install agent-device with `npm install --global agent-device`, or use T3's exact returned launcher and config. Existing Mac hub fields may coexist; `--device android` always uses the local Android host.

## Build, start and develop

From the repository root:

```sh
C=.agents/skills/mobile-verify/scripts/cli
$C build --device android
$C doctor --device android --serial <owned-emulator-serial>
$C start --device android --serial <owned-emulator-serial> --fixture development
```

`build` runs Expo prebuild for Android and the generated Gradle wrapper. The fingerprint includes Android configuration, native modules and the selected ABI; a matching APK can be reused across worktrees on the same architecture. APKs cached for another ABI or under the old universal fingerprint require a rebuild. A rebuild removes its local success marker before prebuild and publishes its shared APK atomically only after the build succeeds and the native inputs are checked again. A failed or interrupted build leaves no local success marker; the error identifies the failed command, exit code or signal and build log. Native changes require another build. JavaScript and TypeScript changes reload through Metro; keep the instance running while iterating. `doctor` reports missing SDK/Java/driver, unavailable emulator and missing native build separately, with the command needed to fix them.

With T3, pass the exact values returned by `device_open` to `start`:

```sh
$C start --device android --serial <returned-serial> \
  --agent-device-command <returned-launcher> \
  --agent-device-config <returned-host-config> \
  --agent-device-session <returned-session> --fixture development
```

The launcher exclusively claims that emulator, compares the installed APK digest with the matching build and installs when it differs or the app is missing, clears development app storage, starts a disposable server and Metro, and uses Android’s built-in `10.0.2.2` host-loopback alias for the allocated server and Metro ports. Host-side fixture reads stay on `127.0.0.1`. No adb reverse mappings or Mac tunnels are created; the emulator connects directly to this disposable instance. Setup pairs through the real Settings form, independently checks the server's registered device, then closes its setup session. `--manual-pairing` instead leaves the client for the developer: Settings → Computers → Add computer → Use development server → Pair. The development pairing endpoint is local to that Metro instance.

## Drive and retain proof

Read the private connection card. Use its entire agent-device command, including the launcher, config, session, `--platform android` and `--serial`, for every operation. Open the card's package with `--foreground`, then use fresh `snapshot -i` refs for presses and fills. Android does not use `prepare ios-runner` or iOS open-link alerts. See [driving](driving.md) and the [feature map](../features/README.md).

For a representative journey, choose the Dispatch Desk project/main worktree, open Review, read its published explanation and open a changed file. Tap an added or deleted native source line, then Comment on selected lines and post literal feedback. The code surface must render without an event-registration overlay, and the composer must show the selected source line. Use the card's `server comment-threads` command to verify the exact message, file, comparison, side and source-line range independently. Save fresh snapshots, screenshots and server readbacks in `evidenceDirectory`; redact one-time pairing links and credentials. Use `--fixture focused` for the small README fixture expected by existing feature maps.

Run the card's `logsCommand` for bounded Android logcat, Metro and server output. Use its `statusCommand` to inspect connection and source freshness. A native fingerprint change requires stop/build/start; a launcher or server edit requires stop/start; ordinary app JavaScript edits keep the live Metro instance.

## Stop and recover

Run the card's `stopCommand`. It closes this run's driver session, force-stops Porcelain Dev, stops captured Metro/server processes, removes disposable runtime data and releases the emulator claim. Evidence remains. A borrowed emulator stays booted; close or shut down the T3 panel only after stopping the instance. Never run `adb reverse --remove-all`, kill processes by name or reset another run's device.

A missing/busy emulator or another live claim is a refusal: stop the owning run or choose an independently owned emulator. The existing claim owner includes process identity so a later run can reclaim a dead owner's claim. Cleanup failures retain protected runtime state and explain what remains; inspect the evidence before retrying stop by instance id. No external port-forward state needs recovery. Keep screenshots containing pairing links private.

This localhost/emulator proof does not establish physical-device LAN permissions, remote-environment routing, iOS behavior or Android store delivery. EAS delivery remains iOS-only.

References: [Expo local builds](https://docs.expo.dev/guides/local-app-development/), [Android emulator setup](https://docs.expo.dev/workflow/android-studio-emulator/), [Android Debug Bridge](https://developer.android.com/tools/adb), [emulator host-loopback networking](https://developer.android.com/studio/run/emulator-networking-address), [React Native single-ABI development builds](https://reactnative.dev/docs/build-speed#build-only-one-abi-during-development-android-only), [Android Gradle CMake arguments](https://developer.android.com/reference/tools/gradle-api/7.4/com/android/build/api/dsl/ExternalNativeBuildOptions), [CMake Ninja job pools](https://cmake.org/cmake/help/v3.22/prop_gbl/JOB_POOLS.html), [Gradle init scripts](https://docs.gradle.org/current/userguide/init_scripts.html).
