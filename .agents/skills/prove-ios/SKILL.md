---
name: prove-ios
version: 0.55.1
metadata:
  internal: true
description: Drive the iOS simulator to observe a change in the mobile client, from a Mac locally or from a Linux box over the LAN. Use when the changed behavior is `apps/mobile` and iOS is the surface — native lifecycle, iOS keyboard, Safari-only rendering, or an iOS screenshot. Read `docs/runtime-proof.md` for what finishes a proof.
---

# Prove iOS

The simulator only runs on macOS, so the route depends on where you are. Both routes end the same
way: the changed behavior observed in a frame whose clock is current.

## Local — you are on the Mac

```sh
pnpm --dir apps/mobile start                       # Metro
pnpm --dir apps/mobile sim:build                   # local simulator build, only when native code moved
pnpm --dir apps/mobile sim:install:local --path <artifact> --simulator '<exact name>'
xcrun simctl list devices                          # the exact name, verbatim
xcrun simctl io <udid> screenshot /tmp/ios.png     # then read the file
```

`sim:install:local` installs the artifact you just built; `sim:install` downloads the latest EAS
build and can quietly replace it with an older one. A JavaScript-only change needs neither —
Fast Refresh carries it, and `eas fingerprint:compare` is what says which case you are in.

## Remote — you are on Linux, the Mac is on the LAN

```sh
ssh mac 'xcrun simctl list devices booted'         # always the `mac` alias: it carries the identity file
ssh mac 'open -a Simulator --args -CurrentDeviceUDID <udid>'   # a headless boot streams no frames
ssh mac 'xcrun simctl io <udid> screenshot /tmp/t.png >/dev/null && cat /tmp/t.png' > /tmp/ios.png
```

Point the simulator's dev client at Metro running on this box, using this box's LAN IP:

```sh
ssh mac 'xcrun simctl openurl <udid> "porcelain-dev://expo-development-client/?url=http%3A%2F%2F<lan-ip>%3A8081"'
```

iOS answers with an "Open in …?" dialog that has to be accepted before Metro sees a bundle request.
For taps and swipes rather than screenshots, run `serve-sim` on the Mac in the foreground —
`--detach` binds only `127.0.0.1:3100`, which this box cannot reach — and drive its HTTP surface on
port 3200.

## Traps

- **Remote Login is often off.** `ssh mac` timing out while `ping macbook.local` answers means the
  Mac is on the LAN with SSH disabled, not that the machine is gone. Turn it on in Sharing.
- **A server answering is not a live frame.** A `serve-sim` whose capture died serves the same
  frozen frame for hours while its other endpoints answer correctly. Trust a frame only when its
  status-bar clock is current; `simctl io … screenshot` is the ground truth that needs no server.
- **`⌘R` cannot reach a worktree's Metro.** Repoint the dev client with
  `ssh mac 'xcrun simctl terminate <udid> <bundle-id>; xcrun simctl launch <udid> <bundle-id>'`.
- **A missing native module is not a JavaScript problem.** `Cannot find native module '…'` means the
  installed dev client predates a native dependency on this branch — build and install a new one.

## Down

Leave a simulator you found booted. Shut down one you booted yourself, and quit Simulator.app:

```sh
ssh mac 'xcrun simctl shutdown <udid>; osascript -e "tell application \"Simulator\" to quit"'
```
