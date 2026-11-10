---
screen: /settings
selectors:
  - 'Settings'
  - 'General'
  - 'Reviews & Git'
  - 'Notifications'
  - 'Computers'
  - 'settings-general'
  - 'settings-reviews-git'
  - 'settings-notifications'
  - 'settings-computers'
  - 'Close Settings'
  - 'Development'
  - 'Component library'
tests:
  - packages/client/src/features/preferences/rules/settings-summary.spec.ts
  - packages/client/src/features/access/rules/settings-updates.spec.ts
  - packages/client/src/features/notifications/rules/notifications.spec.ts
api: []
---

# access.settings

Settings is a modal opened from the gear button labelled Settings on the left of the Reviews and Worktrees headers; Close Settings returns to the tab underneath. It offers General, Reviews & Git, Notifications and Computers, with the app version, and a Development section in development builds. Everything under the native bar uses Porcelain's web look: outlined groups with no fill on the page background, hairlines between rows, plain line icons and web-style section headings, in light and dark. Computers is the only place a computer is named. Each saved computer opens [its page](access.computer.md).

## How to get to it (user POV)

- Settings gear on the Reviews or Worktrees header, or `porcelain.dev://settings` → General, Reviews & Git, Notifications or Computers.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Press Settings on the Reviews header, then on the Worktrees header, and open `porcelain.dev://settings`. Settings opens as a modal with four root rows; each pushes a native destination and Back returns. General summarizes theme and long lines (System theme · Wrap long lines), Reviews & Git says Pull, archive and spec files on each computer, Notifications says Off or what is switched on, and Computers shows the paired count plus N update(s) ready only while a computer offers an update this device may install. Change a General preference and return: its summary follows. While saved computers load the row says Reading saved computers…; unreadable storage says Saved computers could not be read. Root row accessible names begin with General, Reviews & Git, Notifications and Computers, without symbol descriptions. Close Settings returns to the tab and stack position that opened it.
2. Open General and [appearance](preferences.appearance.md); Reviews & Git and [its preferences](preferences.reviews-git.md); Notifications and [its switches](preferences.notifications.md); Computers and [computer management](access.computers.md). Pairing remains on return. Development builds also show Development with Component library.
3. Compare footer version with the installed Expo configuration. No This device page or device ID footer remains.
4. Tablets use the same Settings destinations with platform-native modal chrome. Verify landscape and portrait: rows and About stay bounded, every destination pushes with native Back, and controls remain reachable without overlap.

Automated coverage: `settings-summary.spec.ts`, `settings-updates.spec.ts`.

## Gotchas

- Settings does not change the native release version.
