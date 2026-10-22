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
  - 'Touch and hold a device ID to copy.'
tests:
  - apps/mobile/src/shell/destinations.spec.ts
api: []
---

# access.settings

Settings offers General, Reviews & Git and Computers, with app version and selectable per-computer device IDs.

## How to get to it (user POV)

- Settings tab/sidebar or `porcelain.dev://settings` → General, Reviews & Git or Computers.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open Settings tab/sidebar or `porcelain.dev://settings`. Phones show three root rows; each pushes a native destination and Back returns. iPad shows categories with General immediately, retains the selected category on return and preserves sidebar state.
2. Open General and [appearance](preferences.appearance.md); Reviews & Git and [its preferences](preferences.reviews-git.md); Computers and [computer management](access.computers.md). Pairing remains on return. Development builds also expose the component catalog.
3. Compare footer version with the installed Expo configuration. Hold an ID → Copy; paste and compare independently with that computer's device registration. With multiple computers/routes every ID is labelled by computer/address; no credential is shown.
4. iPad landscape: 224-point category pane and full-height divider, About/IDs bounded below categories. Narrow: categories above detail. Resize/show-hide sidebar/switch categories; controls remain reachable without overlap. Reopen: category stays.

Automated coverage: `destinations.spec.ts`.

## Gotchas

- IDs are route registrations, not one global phone ID. Broken disposable credential storage is needed to prove storage failure; normal startup cannot.
- Settings does not change the native release version.
