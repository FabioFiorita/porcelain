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
  - 'Development'
  - 'Component library'
  - 'Privacy policy'
  - 'settings-privacy-policy'
tests:
  - packages/client/src/features/preferences/rules/settings-summary.spec.ts
  - packages/client/src/features/access/rules/settings-updates.spec.ts
api: []
---

# access.settings

Settings is the last tab of the tab bar. It offers General, Reviews & Git and Computers, with the app version and a Privacy policy action in the footer, and a Development section in development builds. Everything under the native bar uses Porcelain's web look: outlined groups with no fill on the page background, hairlines between rows, plain line icons and web-style section headings, in light and dark. Computers is the only place a computer is named. Each saved computer opens [its page](access.computer.md).

## How to get to it (user POV)

- Settings tab, or `porcelain.dev://settings` → General, Reviews & Git or Computers.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open the Settings tab, then try `porcelain.dev://settings`. Settings shows three root rows; each pushes a native destination and Back returns. General summarizes theme and long lines (System theme · Scroll long lines), Reviews & Git says Pull, archive and spec files on each computer, and Computers shows the paired count plus N update(s) ready only while a computer offers an update this device may install. Change a General preference and return: its summary follows. While saved computers load the row shows no count; unreadable storage says Saved computers could not be read. Root row accessible names begin with General, Reviews & Git and Computers, without symbol descriptions.
2. Open General and [appearance](preferences.appearance.md); Reviews & Git and [its preferences](preferences.reviews-git.md); Computers and [computer management](access.computers.md). Pairing remains on return. Development builds also show Development with Component library.
3. Compare footer version with the installed Expo configuration. No This device page or device ID footer remains. Activate Privacy policy (`settings-privacy-policy`): the system browser opens `https://porcelain.fabiofiorita.com/privacy/`. Return to Porcelain and confirm Settings remains available. A URL-opening failure shows an accessible error in the footer instead of silently failing.
4. Tablets with at least 700 units of content width show the Settings list beside the chosen page (General first, the chosen row selected); Component library and Keyboard Shortcuts still push. Narrower content pushes as on a phone. Verify landscape and portrait: rows and About stay bounded, every destination pushes with native Back, and controls remain reachable without overlap.

Automated coverage: `settings-summary.spec.ts`, `settings-updates.spec.ts`.

## Gotchas

- Settings does not change the native release version.
