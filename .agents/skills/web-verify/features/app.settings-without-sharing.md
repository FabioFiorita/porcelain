---
route: /settings/$section
selectors:
  - 'Settings'
  - 'Settings sections'
  - 'General'
  - 'Reviews & Git'
  - 'Computers'
  - 'Pair a device'
  - 'Copy MCP configuration'
  - 'Open This computer:'
  - 'Disconnect this browser'
tests:
  - apps/web/spec/e2e/app-settings-without-sharing.e2e.ts
api:
  - GET /api/access
  - GET /api/inventory
  - GET /api/remote-access
  - GET /api/service/update
---

# app.settings-without-sharing

Browser Settings has the same three sections as desktop. Computers starts with This computer and includes saved computers, versions, update offers and the existing paste-pairing-link form. Devices and Agents are inside Computers → This computer in browser mode too.

## How to get to it (user POV)

- Web workspace sidebar → Settings; Computers and Updates controls.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Start a web verification instance and pair the browser. Open the sidebar, check that its application header says Porcelain and each project has a visible Computer: <name> badge, then click Settings. Expect `/settings/general` and section buttons General, Reviews & Git and Computers, with Close Settings in the top bar.

Click Computers, then Open This computer: <name>. Expect `/settings/computers/this-computer`, its current version and update state, Ways in, and Disconnect this browser. A local authorized browser shows Pair a device and Devices (list "Paired devices and links"). A remote browser whose `GET /api/access` is denied sees the one-line reason: Sharing is managed from a browser on the computer that runs Porcelain, and no administration controls are mounted. Its Ways in shows the editor only when the owner let its device edit ways in; when `GET /api/remote-access` is denied it says: This device cannot see or change ways in, or, when the browser reaches the computer through its own address, that ways in cannot be seen or changed over this connection.

Open `/settings/computers/a-saved-computer` directly. It keeps the Computers section and explains the missing saved computer; it does not redirect to another section. Legacy Devices and Integrations links redirect to This computer; unknown section slugs show the app's recoverable not-found view.

Automated coverage: `app-settings-without-sharing.e2e.ts`.

## Gotchas

- Host authorization, not shell identity, controls Devices administration.
