---
name: prove-ios
version: 0.57.2
metadata:
  internal: true
description: Drive the iOS simulator to observe a change in the mobile client, from a Mac locally or from a Linux box over the LAN. Use when the changed behavior is `apps/mobile` and iOS is the surface — native lifecycle, iOS keyboard, Safari-only rendering, or an iOS screenshot. Read `docs/runtime-proof.md` for what finishes a proof.
---

# Prove iOS

The simulator only runs on macOS, so the route depends on where you are. Both routes drive it with
the **XcodeBuildMCP CLI** (`xcodebuildmcp`, installed on the Mac), which reads the screen as an
accessibility tree and taps by identity — the same shape as `prove-android`'s `ui`/`tap` and
`agent-browser`'s `snapshot`/`click`. Discover any command's arguments with `--help`; the tool
moves faster than this file.

```sh
xcodebuildmcp simulator --help          # boot, install, launch-app, screenshot, snapshot-ui
xcodebuildmcp ui-automation --help      # tap, swipe, type-text, key-press, gesture
```

## The loop

```sh
SIM=<udid>                                             # simulator-management list

xcodebuildmcp simulator-management boot --simulator-id $SIM
xcodebuildmcp simulator-management open --simulator-id $SIM   # a headless boot streams no frames
xcodebuildmcp simulator install --simulator-id $SIM --app-path <PorcelainDev.app>
xcodebuildmcp simulator snapshot-ui --simulator-id $SIM        # AXLabel + AXUniqueId + frames
xcodebuildmcp ui-automation tap --simulator-id $SIM --id porcelain-phone-search --post-delay 2
xcodebuildmcp simulator screenshot --simulator-id $SIM --return-format path
```

`--id` is the React Native `testID` (it arrives as `AXUniqueId`) and is the handle to prefer;
`--label` matches visible text and is what system dialogs answer to. Coordinates are the fallback,
read from `snapshot-ui`'s `frame` — never guessed.

## Point the dev client at Metro

Metro runs wherever the repository is. On the Mac that is `localhost`; from Linux it is this box's
LAN IP, and the simulator reaches it over the network like any device.

```sh
pnpm dev:env                                            # note this profile's Metro port
pnpm dev:mobile                                         # Metro, on the machine with the code
xcrun simctl openurl $SIM "porcelain-dev://expo-development-client/?url=http%3A%2F%2F<host>%3A<metro-port>"
xcodebuildmcp ui-automation tap --simulator-id $SIM --label "Open"   # the "Open in …?" dialog
```

A JavaScript-only change needs nothing more — Fast Refresh carries it. Native code moved means a
new dev client: `pnpm --dir apps/mobile sim:build` then `sim:install:local --path <artifact>`.
`sim:install` (no `:local`) downloads the latest EAS build and can quietly replace yours with an
older one. `eas fingerprint:compare` is what says which case you are in.

## Remote — you are on Linux, the Mac is on the LAN

Every command above runs through `ssh mac '…'` (always the `mac` alias: it carries the identity
file). Two things change:

- **Screenshots land on the Mac.** `--return-format path` prints a path *there*; bring the file
  back with `ssh mac 'cat <path>' > /tmp/ios.png`, then read it.
- **An already-built dev client is usually on the Mac already.** `ls -dt
  ~/Library/Developer/Xcode/DerivedData/PorcelainDev-*/Build/Products/*/*.app` finds it, newest
  first — check its mtime against the branch before trusting it.

## Traps

- **Remote Login is often off.** `ssh mac` timing out while `ping macbook.local` answers means the
  Mac is on the LAN with SSH disabled, not that the machine is gone. Turn it on in Sharing.
- **A native tab bar exposes no per-tab label.** `snapshot-ui` shows one "Tab Bar" element, so
  `--label "Terminal"` fails on the tab strip; tap the `testID` with `--id`, or the frame
  coordinates from the snapshot.
- **`⌘R` cannot reach a worktree's Metro.** Repoint the dev client with
  `xcodebuildmcp simulator stop` + `launch-app`, or `xcrun simctl terminate`/`launch`.
- **Fast Refresh cannot re-create a native view.** A prop a native host reads once at mount —
  `@expo/ui`'s `matchContents` is one — keeps its old value in every view already on screen, so a
  correct fix to a hosted component looks like it did nothing on the surfaces you had already
  opened. Relaunch (`xcrun simctl terminate` + `launch`) before believing a negative result.
- **A missing native module is not a JavaScript problem.** `Cannot find native module '…'` means the
  installed dev client predates a native dependency on this branch — build and install a new one.
- **A frame is only proof if its clock is current.** The status bar is the cheapest check that you
  are looking at now rather than at a stale capture.

## Down

Leave a simulator you found booted — the human usually has several. Shut down only the one you
booted, and quit Simulator.app only if you opened it.

```sh
xcrun simctl shutdown $SIM
```
