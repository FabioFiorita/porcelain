# Android development on Linux

The mobile launcher builds and runs Porcelain Dev locally on Linux or macOS. It uses the same disposable server, fixture, pairing, Metro, evidence and cleanup owners as iOS.

## Prepare your machine

Install the repository's Node and pnpm versions and run `pnpm install`. Install Android Studio with its SDK, platform-tools, emulator and a system image; set `ANDROID_HOME` to your SDK directory and add `$ANDROID_HOME/platform-tools` to `PATH`. Install JDK 17 or newer, compatible with the generated Android Gradle plugin and set `JAVA_HOME` when Java is not already on your path. SDK Manager supplies missing SDK platforms, build-tools, NDK and CMake versions reported by the build; accept SDK licenses there. The first build downloads Gradle/native dependencies; subsequent builds reuse matching APKs.

The development build selects one host-native emulator ABI: x86_64 on an x64 host, arm64-v8a on an arm64 host; other host architectures are refused. Use an emulator matching the host: startup checks its primary ABI before installing or clearing app data. The launcher keeps Gradle at two workers, a 2 GiB heap, 1 GiB maximum metaspace and in-process Kotlin compilation. Gradle's worker limit alone does not limit Ninja. A build-only Gradle init script configures every Android app/library project's CMake compile and link jobs to share a two-job Ninja pool, allowing at most four concurrent native compiler/link jobs across the two Gradle workers. Release builds are unaffected.

On Linux, `build --device android` checks `/proc/meminfo` before Expo prebuild or Gradle starts. It requires 8 GiB of **available** RAM (swap does not count), separately from the 4 GiB floor for starting a disposable verification instance. On the 26 GiB Linux verification host, a clean native build peaked at 5.42 GiB of aggregate build-process RSS with four compilers, leaving about 2.58 GiB of margin at that floor. Insufficient or unreadable available memory causes a refusal explaining the build budget and how to recover; wait or stop a process you own, then retry. This check observes available memory; it does not reserve it against other work. macOS does not have `/proc/meminfo` and keeps its existing startup policy.

Configure `agentDevice` and optionally `androidSerial` in the [machine-local host file](remote.md).

## Phone and tablet profiles

Create a phone and a tablet profile once in Android Studio's Device Manager, using the host-native ABI above. Device provisioning and boot/shutdown belong to the machine's device tool; the mobile launcher selects an already booted local emulator by serial. Physical devices are refused because starts clear development app data. Keep personal profile names and serial defaults in machine-local configuration.

Use the phone for shared phone journeys and a proper tablet profile for shared tablet journeys. Enlarging the phone window or changing screenshot dimensions is insufficient: `expo-device` must classify the device as `DeviceType.TABLET`. The shared `ListDetail` component then uses its measured content width: at least 700dp shows a 340dp list beside detail, while a narrower content area stacks. Screen pixels alone do not establish the content width because density, insets and native chrome reduce the available space.

Choose a tablet whose content area can reach that width in both landscape and portrait. Through the bound device driver, verify Reviews and Worktrees list/detail selection, a pushed screen and its Back path, Settings open/close, and rotation with a selected review or worktree. Selection, list position and unsent drafts stay with their original workspace. Retain both orientations and the observed layout; refresh geometry and refs after rotation, then restore the original orientation. Use [the shell map](../features/app.shell.md) for the detailed journey.

Android tablet checks cover the shared layout and Android navigation. They do not establish iPad's native tab sidebar, iOS sheet behavior or Apple-specific input and accessibility behavior.

## Build, start and develop

From the repository root:

```sh
C=.agents/skills/mobile-verify/scripts/cli
$C build --device android
$C doctor --device android --serial <owned-emulator-serial>
$C start --device android --serial <owned-emulator-serial> --fixture development
```

The same commands select either profile; use its actual serial rather than assuming one fixed emulator port. When a device tool supplies an executable, configuration and session, preserve them through the launcher's `--agent-device-command`, `--agent-device-config` and `--agent-device-session` options instead of creating another driver session.

`build` runs Expo prebuild for Android and the generated Gradle wrapper. The fingerprint includes Android configuration, native modules and the selected ABI; a matching APK can be reused across worktrees on the same architecture. APKs cached for another ABI or under the old universal fingerprint require a rebuild. A rebuild removes its local success marker before prebuild and publishes its shared APK atomically only after the build succeeds and the native inputs are checked again. A failed or interrupted build leaves no local success marker; the error identifies the failed command, exit code or signal and build log. Native changes require another build. JavaScript and TypeScript changes reload through Metro; keep the instance running while iterating. `doctor` reports missing SDK/Java/driver, unavailable emulator and missing native build separately, with the command needed to fix them.

The launcher exclusively claims that emulator, compares the installed APK digest with the matching build and installs when it differs or the app is missing, clears development app storage, starts a disposable server and Metro, and uses Android’s built-in `10.0.2.2` host-loopback alias for the allocated server and Metro ports. Host-side fixture reads stay on `127.0.0.1`. The emulator connects directly without adb reverse mappings. Setup pairs through the real Settings form, independently checks the server's registered device, then closes its setup session. `--manual-pairing` instead leaves the client for the developer: Settings → Computers → Add computer → Use development server → Pair.

## Drive and retain proof

Read the private connection card. Use its entire agent-device command, including the launcher, config, session, `--platform android` and `--serial`, for every operation. Open the card's package with `--foreground`, then use fresh `snapshot -i` refs for presses and fills. Android does not use `prepare ios-runner` or iOS open-link alerts. See [driving](driving.md) and the [feature map](../features/README.md).

For a representative journey, choose the Dispatch Desk project/main worktree, open Walkthrough and ask a question in its conversation. Use its top-bar Changes action to open a diff, then mark it Reviewed. Verify that the document bar has no worktree Comment action, and use the card's `server reviewed-files` command to independently check the saved fingerprint. Save fresh snapshots, screenshots and readbacks in `evidenceDirectory`; redact pairing links and credentials. Use `--fixture focused` for the small README fixture.

Run the card's `logsCommand` for bounded Android logcat, Metro and server output. Use its `statusCommand` to inspect connection and source freshness. A native fingerprint change requires stop/build/start; a launcher or server edit requires stop/start; ordinary app JavaScript edits keep the live Metro instance.

## Stop and recover

Run the card's `stopCommand`. It closes this run's driver session, force-stops Porcelain Dev, stops captured Metro/server processes, removes disposable runtime data and releases the emulator claim. Evidence remains. A borrowed emulator stays booted.

A missing/busy emulator or another live claim is a refusal: stop the owning run or choose an independently owned emulator. Cleanup failures retain protected runtime state and explain what remains; inspect the evidence before retrying stop by instance id. Keep screenshots containing pairing links private.

This localhost/emulator proof does not establish physical-device LAN permissions, remote-environment routing, iOS behavior or Android store delivery. EAS delivery remains iOS-only.

References: [Expo local builds](https://docs.expo.dev/guides/local-app-development/), [Android emulator setup](https://docs.expo.dev/workflow/android-studio-emulator/), [Android Debug Bridge](https://developer.android.com/tools/adb), [emulator host-loopback networking](https://developer.android.com/studio/run/emulator-networking-address), [React Native single-ABI development builds](https://reactnative.dev/docs/build-speed#build-only-one-abi-during-development-android-only), [Android Gradle CMake arguments](https://developer.android.com/reference/tools/gradle-api/7.4/com/android/build/api/dsl/ExternalNativeBuildOptions), [CMake Ninja job pools](https://cmake.org/cmake/help/v3.22/prop_gbl/JOB_POOLS.html), [Gradle init scripts](https://docs.gradle.org/current/userguide/init_scripts.html).
