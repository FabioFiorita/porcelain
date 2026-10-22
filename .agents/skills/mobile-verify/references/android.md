# Android development on Linux

The mobile launcher builds and runs Porcelain Dev locally on Linux or macOS. It uses the same disposable server, fixture, pairing, Metro, evidence and cleanup owners as iOS.

## Prepare your machine

Install the repository's Node and pnpm versions and run `pnpm install`. Install Android Studio with its SDK, platform-tools, emulator and a system image; set `ANDROID_HOME` to your SDK directory and add `$ANDROID_HOME/platform-tools` to `PATH`. Install JDK 17 or newer, compatible with the generated Android Gradle plugin and set `JAVA_HOME` when Java is not already on your path. SDK Manager supplies missing SDK platforms, build-tools, NDK and CMake versions reported by the build; accept SDK licenses there. The first build downloads Gradle/native dependencies; subsequent builds reuse matching APKs.

Create an emulator once in Android Studio's Device Manager. Boot it and use `adb devices -l` to read its serial. Select a booted local emulator explicitly; physical devices are refused because starts clear development app data.

Configure `agentDevice` and optionally `androidSerial` in the [machine-local host file](remote.md).

## Build, start and develop

From the repository root:

```sh
C=.agents/skills/mobile-verify/scripts/cli
$C build --device android
$C doctor --device android --serial <owned-emulator-serial>
$C start --device android --serial <owned-emulator-serial> --fixture development
```

`build` runs Expo prebuild for Android and the generated Gradle wrapper. The fingerprint includes Android configuration and native modules; a matching APK can be reused across worktrees. Native changes require another build. JavaScript and TypeScript changes reload through Metro; keep the instance running while iterating. `doctor` reports missing SDK/Java/driver, unavailable emulator and missing native build separately, with the command needed to fix them.

The launcher exclusively claims that emulator, compares the installed APK digest with the matching build and installs when it differs or the app is missing, clears development app storage, starts a disposable server and Metro, and uses Android’s built-in `10.0.2.2` host-loopback alias for the allocated server and Metro ports. Host-side fixture reads stay on `127.0.0.1`. The emulator connects directly without adb reverse mappings. Setup pairs through the real Settings form, independently checks the server's registered device, then closes its setup session. `--manual-pairing` instead leaves the client for the developer: Settings → Computers → Add computer → Use development server → Pair.

## Drive and retain proof

Read the private connection card. Use its entire agent-device command, including the launcher, config, session, `--platform android` and `--serial`, for every operation. Open the card's package with `--foreground`, then use fresh `snapshot -i` refs for presses and fills. Android does not use `prepare ios-runner` or iOS open-link alerts. See [driving](driving.md) and the [feature map](../features/README.md).

For a representative journey, choose the Dispatch Desk project/main worktree, open Review, read its published explanation and open a changed file. Tap an added or deleted native source line, then Comment on selected lines and post literal feedback. The code surface must render without an event-registration overlay, and the composer must show the selected source line. Use the card's `server comment-threads` command to verify the exact message, file, comparison, side and source-line range independently. Save fresh snapshots, screenshots and server readbacks in `evidenceDirectory`; redact one-time pairing links and credentials. Use `--fixture focused` for the small README fixture expected by existing feature maps.

Run the card's `logsCommand` for bounded Android logcat, Metro and server output. Use its `statusCommand` to inspect connection and source freshness. A native fingerprint change requires stop/build/start; a launcher or server edit requires stop/start; ordinary app JavaScript edits keep the live Metro instance.

## Stop and recover

Run the card's `stopCommand`. It closes this run's driver session, force-stops Porcelain Dev, stops captured Metro/server processes, removes disposable runtime data and releases the emulator claim. Evidence remains. A borrowed emulator stays booted.

A missing/busy emulator or another live claim is a refusal: stop the owning run or choose an independently owned emulator. Cleanup failures retain protected runtime state and explain what remains; inspect the evidence before retrying stop by instance id. Keep screenshots containing pairing links private.

This localhost/emulator proof does not establish physical-device LAN permissions, remote-environment routing, iOS behavior or Android store delivery. EAS delivery remains iOS-only.

References: [Expo local builds](https://docs.expo.dev/guides/local-app-development/), [Android emulator setup](https://docs.expo.dev/workflow/android-studio-emulator/), [Android Debug Bridge](https://developer.android.com/tools/adb), [emulator host-loopback networking](https://developer.android.com/studio/run/emulator-networking-address).
