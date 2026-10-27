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
  - 'settings-development'
  - 'This computer'
  - 'Devices'
  - 'Pair a device'
tests:
  - apps/mobile/src/shell/destinations.spec.ts
  - packages/client/src/features/preferences/rules/settings-summary.spec.ts
  - packages/client/src/features/access/rules/settings-updates.spec.ts
api: []
---

# access.settings

Settings offers General, Reviews & Git and Computers, with the app version. Computers is the only place a computer is named. Each saved computer opens This computer, with Devices and Pair a device. Device administration belongs to a browser on the computer running Porcelain, so the phone shows that requirement instead of host-only controls.

## How to get to it (user POV)

- Settings tab/sidebar or `porcelain.dev://settings` → General, Reviews & Git or Computers.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open Settings tab/sidebar or `porcelain.dev://settings`. Phones show three root rows; each pushes a native destination and Back returns. General summarizes theme and long lines (System theme · Wrap long lines), Reviews & Git says Pull, archive and spec files on each computer, and Computers shows the paired count plus N update(s) ready only while a computer offers an update this device may install. Change a General preference and return: its summary follows. While saved computers load the row says Reading saved computers…; unreadable storage says Saved computers could not be read. iPad shows categories with General immediately, retains the selected category on return and preserves sidebar state.
2. Open General and [appearance](preferences.appearance.md); Reviews & Git and [its preferences](preferences.reviews-git.md); Computers and [computer management](access.computers.md). Pairing remains on return. Development builds also expose the component catalog.
3. Compare footer version with the installed Expo configuration. Open Computers → This computer on a paired computer. Expect that computer's name and address, Devices and Pair a device, and instructions to manage devices or create a link in a browser on that computer. Close returns to Computers. With multiple computers open each one and verify its identity. No This device page or device ID footer remains.
4. iPad landscape: 224-point category pane and full-height divider, About bounded below categories; This computer opens from Computers. Narrow: categories above detail. Resize/show-hide sidebar/switch categories; controls remain reachable without overlap. Reopen: category stays.

Automated coverage: `destinations.spec.ts`.

## Gotchas

- This computer names the selected host, not the phone. Native clients cannot administer devices or create pairing links; the server requires a local browser. Broken disposable credential storage is needed to prove storage failure; normal startup cannot.
- Settings does not change the native release version.
