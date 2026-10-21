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

## What it is

On iPhone and Android, Settings has General (theme, code and documents), Reviews & Git (archive deletion, pull and commit model), and Computers. Each row opens a native stack destination; Back returns to Settings. Development builds also offer Component library. The bottom shows this app's actual Expo version and selectable device IDs labelled by computer and, with multiple routes, address. IDs are registration-specific, not one global phone identifier.

On iPad, General starts visible beside categories General, Reviews & Git, Computers and Development in development builds. Selecting a category replaces the detail; returning retains it. The sidebar stays in its current state. A wide window has a 224-point category pane and full-height divider; a narrow window places categories above the detail. About and device IDs sit below the categories and remain bounded by the pane.

## Drive it

1. Open the Settings tab/sidebar or porcelain.dev://settings. On phone expect the three root rows; on iPad expect the categories and General controls. Confirm the sidebar state is preserved.
2. Open General and follow preferences.appearance. Back on phone returns to root. Open Reviews & Git and follow preferences.reviews-git; archive switches must be absent from General.
3. Open Computers and follow access.computers, access.pairing, access.connections and access.forget-environment. Back returns to Settings on phone. Revisit and confirm pairing is retained.
4. Read the footer app version against the installed Expo configuration. Touch and hold an ID, select Copy and independently compare the pasted ID with that computer's registered device. With two computers/routes, confirm every ID is labelled; no secret credential appears.
5. On iPad resize landscape to a narrow window, switch categories and show/hide the app sidebar. Every control remains reachable without drawing under the sidebar. Reopen Settings and confirm the selected category.

## Evidence and limits

Retain native screenshots and device/storage readbacks with mobile-verify. Android does not prove iPhone/iPad. Storage failure requires a broken disposable credential fixture; normal startup does not prove it. These settings do not alter the native release version.
