---
route: /settings/$section
shell: desktop
selectors:
  - 'Settings'
  - 'Settings sections'
  - 'General'
  - 'Reviews & Git'
  - 'Computers'
  - 'Devices'
  - 'Integrations'
  - 'Open This computer'
  - 'Ways in'
  - 'Local network'
tests:
  - apps/web/spec/e2e/app-settings-scope.desktop.e2e.ts
api:
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# app.settings-scope

Desktop and browser show the same five sections in this order: General, Reviews & Git, Computers, Devices, Integrations. General is the default. No About or search section exists. The muted sidebar footer shows the app version and Esc to close.

## How to get to it (user POV)

- Workspace sidebar → Settings; choose General, Reviews & Git, Computers, Devices or Integrations.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Start a desktop verification instance, pair the browser, open the workspace sidebar and click Settings. The URL is `/settings/general`; the page replaces the workspace. Click Computers, then Open This computer: `/settings/computers/this-computer` shows its name, connection, app or service updater, and Ways in. Local network, Tailscale and Cloudflare tunnel stay in that detail, rather than separate settings destinations. Do not change route switches during this navigation check.

Click Devices: it shows Pair a device and Paired devices for a host-authorized browser. Click Integrations: it shows the copyable Porcelain MCP server command and retries a failed desktop configuration read. Click Reviews & Git: archive toggles, pull strategy and the grouped commit model selector appear, with the explicit per-device preference copy.

Automated coverage: `app-settings-scope.desktop.e2e.ts`.

## Gotchas

- This computer has different controls for host permission and browser disconnect; desktop mode alone does not grant host permission.
