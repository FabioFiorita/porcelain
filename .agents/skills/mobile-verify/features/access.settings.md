---
screen: /settings
selectors:
  - 'Settings'
  - 'General'
  - 'Reviews & Git'
  - 'Computers'
  - 'settings-general'
  - 'settings-reviews-git'
  - 'settings-computers'
  - 'Close Settings'
  - 'Development'
  - 'Component library'
  - 'This computer'
  - 'Devices'
  - 'Pair a device'
  - 'Ways in'
  - 'Local network'
  - 'Tailscale'
  - 'Cloudflare tunnel'
tests:
  - packages/client/src/features/preferences/rules/settings-summary.spec.ts
  - packages/client/src/features/access/rules/settings-updates.spec.ts
  - packages/client/src/features/access/commands/share.spec.ts
api:
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# access.settings

Settings is a modal opened from the gear button labelled Settings on the left of the Reviews and Worktrees headers; Close Settings returns to the tab underneath. It offers General, Reviews & Git and Computers, with the app version, and a Development section in development builds. Computers is the only place a computer is named. Each saved computer opens This computer, with Ways in, Devices and Pair a device. Ways in shows that computer's local network, Tailscale and Cloudflare tunnel when its owner let this phone edit ways in; the way in the phone is connected through is locked with an explanation, and without the permission it says this device cannot see or change ways in; over a connection to the computer's own address (127.0.0.1, localhost or the emulator's 10.0.2.2, as `adb reverse` and the Android emulator connect) it says ways in cannot be seen or changed over this connection. Device administration belongs to a browser on the computer running Porcelain, so the phone shows that requirement instead of host-only controls.

## How to get to it (user POV)

- Settings gear on the Reviews or Worktrees header, or `porcelain.dev://settings` → General, Reviews & Git or Computers.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Press Settings on the Reviews header, then on the Worktrees header, and open `porcelain.dev://settings`. Settings opens as a modal with three root rows; each pushes a native destination and Back returns. General summarizes theme and long lines (System theme · Wrap long lines), Reviews & Git says Pull, archive and spec files on each computer, and Computers shows the paired count plus N update(s) ready only while a computer offers an update this device may install. Change a General preference and return: its summary follows. While saved computers load the row says Reading saved computers…; unreadable storage says Saved computers could not be read. Root row accessible names begin with General, Reviews & Git and Computers, without symbol descriptions. Close Settings returns to the tab and stack position that opened it.
2. Open General and [appearance](preferences.appearance.md); Reviews & Git and [its preferences](preferences.reviews-git.md); Computers and [computer management](access.computers.md). Pairing remains on return. Development builds also show Development with Component library.
3. Compare footer version with the installed Expo configuration. Open Computers → This computer on a paired computer. Expect that computer's name and address, Devices and Pair a device, and instructions to manage devices or create a link in a browser on that computer. Close returns to Computers. With multiple computers open each one and verify its identity. No This device page or device ID footer remains.
4. iPad shows the same modal stack. Verify landscape and portrait: rows and About stay bounded, every destination pushes with native Back, and controls remain reachable without overlap.

Automated coverage: `settings-summary.spec.ts`, `settings-updates.spec.ts`, `share.spec.ts`.

## Gotchas

- Grant or remove "<device> can edit ways in" from a host browser's Paired devices, then reopen This computer to see the editor appear or disappear; the phone cannot grant it to itself.
- This computer names the selected host, not the phone. Native clients cannot administer devices or create pairing links; the server requires a local browser. Broken disposable credential storage is needed to prove storage failure; normal startup cannot.
- Settings does not change the native release version.
