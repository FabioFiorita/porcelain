---
route: /settings/$section
selectors:
  - 'Settings'
  - 'Settings sections'
  - 'General'
  - 'Reviews & Git'
  - 'Computers'
  - 'Devices'
  - 'Integrations'
  - 'Open This computer'
  - 'Disconnect this browser'
tests:
  - apps/web/spec/e2e/app-settings-without-sharing.e2e.ts
api:
  - GET /api/inventory
  - GET /api/remote-access
  - GET /api/service/update
---

# app.settings-without-sharing

Browser Settings has the same five sections as desktop. Computers starts with This computer and includes saved computers, versions, update offers and the existing paste-pairing-link form. Devices is visible in browser mode too.

## Driving it

Start a web verification instance and pair the browser. Open the sidebar, note the host name beneath Porcelain, then click Settings. Expect `/settings/general` and buttons General, Reviews & Git, Computers, Devices, Integrations and Back.

Click Computers, then Open This computer. Expect `/settings/computers/this-computer`, its current version and update state, Ways in, and Disconnect this browser. Click Devices. A local authorized browser shows Pair a device and Paired devices. A remote browser whose `GET /api/remote-access` is denied sees the one-line reason: Sharing is managed from a browser on the computer that runs Porcelain. No administration controls are mounted in that case.

Open `/settings/computers/a-saved-computer` directly. It keeps the Computers section and explains the missing saved computer; it does not redirect to another section. Obsolete section slugs show the app's recoverable not-found view.

## What proves it works

The same section list in both shells, browser Disconnect in This computer, visible Devices with host permission gating, and direct missing-computer recovery. The listed E2E covers the host-authorized browser; final remote-browser authorization proof belongs to the combined parent verification.
