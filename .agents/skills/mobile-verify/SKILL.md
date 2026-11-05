---
name: mobile-verify
description: Prepare a disposable Porcelain mobile run, drive its development client with this machine's agent-device CLI, and retain evidence. Use before calling a mobile change done or correcting maps.
---

# Mobile verification

From the repository root, `C=.agents/skills/mobile-verify/scripts/cli`. Run `$C` for command help. Machine-specific configuration belongs in the ignored [host file](references/remote.md).

## Prepare

1. Choose a device for the changed behavior. Shared mobile journeys run on a local Android phone emulator; shared tablet journeys use a proper Android tablet emulator in landscape and portrait. Both use `--device android --serial <serial>` on an already booted emulator. iOS-specific behavior needs an iOS run: allocate from the existing simulator pool (`--device ipad` for iPad) or borrow a booted `--udid`. Missing/busy devices are refused. See [Android setup](references/android.md#phone-and-tablet-profiles).
2. Run `$C doctor` with the selected device flags. Resolve its dependency, driver and native-build failures before starting. Native changes need `$C build` on macOS for iOS, or `$C build --device android` locally.
3. Run `$C start --fixture focused` with those flags for mapped journeys. The CLI prepares the disposable server, Metro and device claim, waits for the loaded app, pairs through Use development server → enabled Pair without typing a long link, independently checks its native registration, then closes setup.
4. Read the short card and private `connection.json`: build identity, fixture paths, app/Metro URLs, complete agent-device command, logs, evidence and stop command.

When a device tool supplies a bound driver, pass its executable, private configuration and session with `--agent-device-command`, `--agent-device-config` and `--agent-device-session`, alongside that device's `--serial` or `--udid`. Use the same flags for `doctor` and `start`; preserve the resulting card's full invocation throughout the journey. The external tool owns emulator boot/shutdown; this CLI owns the disposable app run and releases its claim before the device is closed.

## Drive

5. Use the card's entire agent-device CLI invocation, including config, session, platform and device flags. Open its app with `--foreground`; on iOS, then run `prepare ios-runner`. See [driving](references/driving.md).
6. Read [the feature map](features/README.md). Drive its entry points and return path; retain fresh snapshots, screenshots and independent server/storage readbacks in the card's evidence directory. Keep pairing links and host tokens private.

For a developer walkthrough, use `--manual-pairing`. It opens the development client and leaves pairing to Settings → Computers → Add computer → Use development server → Pair.

The default `--fixture development` seeds Dispatch Desk: nested source/docs, previews, long lines, two worktrees, merge history, varied Git changes and a published review with verdict/comments. `fixture.json` records its seed operations. `--fixture focused` uses the small README fixture without seeded reviews/comments. Restart to reset either fixture.

## Restart and stop

Keep one instance per surface while iterating; Metro reloads JavaScript edits. Native changes require stop/build/start; server or launcher edits require stop/start. Run changed tests by name plus the map's named test for the changed feature.

Starts clear development app data and the iOS keychain. Matching native fingerprints are required; Android also compares the installed APK digest. Physical Android devices are refused. Report the platform and connection actually proved; emulator loopback does not prove physical-device LAN permission or another platform.

Android tablet proof establishes shared tablet behavior on Android. Native iPad tab sidebars, iOS sheets, keyboard behavior, Dynamic Type, permissions and native modules require iOS proof when the change affects them. An unrelated shared change does not require repeating those platform-specific journeys.

An iOS Preview startup repair requires a fresh Release artifact with embedded JavaScript, built from the changed native inputs. Retain its build ID, source commit, runtime fingerprint, bundle identifier and version/build number. Cold-launch that exact artifact without Metro on the intended physical iPhone and iPad; retain launch logs and confirm the app reaches its first usable screen without a native loader failure. Development-client, simulator, export and build success do not establish physical Preview launch proof. An SDK or native configuration change invalidates older native artifacts; do not reuse their proof or overwrite shared development caches to qualify Preview.

Finally, run the card's logs and stop commands. Stop releases the claim and removes runtime data while retaining evidence. Pooled iOS simulators shut down; borrowed devices stay booted. Failed cleanup retains private state: inspect and retry by instance ID.
