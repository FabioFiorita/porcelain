---
name: mobile-verify
description: Prepare a disposable Porcelain mobile run, drive its development client with this machine's agent-device CLI, and retain evidence. Use before calling a mobile change done or correcting maps.
---

# Mobile verification

From the repository root, `C=.agents/skills/mobile-verify/scripts/cli`. Run `$C` for command help. Machine-specific configuration belongs in the ignored [host file](references/remote.md).

## Prepare

1. Choose a device. Android requires a booted emulator with `--device android --serial <serial>`. iOS allocates from the existing simulator pool (`--device ipad` for iPad) or borrows a booted `--udid`. Missing/busy devices are refused. See [Android setup](references/android.md).
2. Run `$C doctor` with the selected device flags. Resolve its dependency, driver and native-build failures before starting. Native changes need `$C build` on macOS for iOS, or `$C build --device android` locally.
3. Run `$C start --fixture focused` with those flags for mapped journeys. The CLI prepares the disposable server, Metro and device claim, pairs through Use development server → Pair without typing a pairing link, checks the registered native device, then closes its setup session.
4. Read the short card and private `connection.json`: build identity, fixture paths, app/Metro URLs, complete agent-device command, logs, evidence and stop command.

## Drive

5. Use the card's entire agent-device CLI invocation, including config, session, platform and device flags. Open its app with `--foreground`; on iOS, then run `prepare ios-runner`. See [driving](references/driving.md).
6. Read [the feature map](features/README.md). Drive its entry points and return path; retain fresh snapshots, screenshots and independent server/storage readbacks in the card's evidence directory. Keep pairing links and host tokens private.

For a developer walkthrough, use `--manual-pairing`. It opens the development client and leaves pairing to Settings → Computers → Add computer → Use development server → Pair.

The default `--fixture development` seeds Dispatch Desk: nested source/docs, previews, long lines, two worktrees, merge history, varied Git changes and a published review with verdict/comments. `fixture.json` records its seed operations. `--fixture focused` uses the small README fixture without seeded reviews/comments. Restart to reset either fixture.

## Restart and stop

Keep one instance per surface while iterating; Metro reloads JavaScript edits. Native changes require stop/build/start; server or launcher edits require stop/start. Run changed tests by name plus the map's named test for the changed feature.

Starts clear development app data and the iOS keychain. Matching native fingerprints are required; Android also compares the installed APK digest. Physical Android devices are refused. Report the platform and connection actually proved; emulator loopback does not prove physical-device LAN permission or another platform.

Finally, run the card's logs and stop commands. Stop releases the claim and removes runtime data while retaining evidence. Pooled iOS simulators shut down; borrowed devices stay booted. Failed cleanup retains private state: inspect and retry by instance ID.
