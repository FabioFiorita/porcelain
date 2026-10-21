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

## Driving it

Start a desktop verification instance, pair the browser, open the workspace sidebar and click Settings. The URL is `/settings/general`; the page replaces the workspace. Click Computers, then Open This computer: `/settings/computers/this-computer` shows its name, connection, app or service updater, and Ways in. Local network, Tailscale and Cloudflare tunnel stay in that detail, rather than separate settings destinations. Do not change route switches during this navigation check.

Click Devices: it shows Pair a device and Paired devices for a host-authorized browser. Click Integrations: it shows the copyable Porcelain MCP server command and retries a failed desktop configuration read. Click Reviews & Git: archive toggles, pull strategy and the grouped commit model selector appear, with the explicit per-device preference copy.

## What proves it works

The exact five section buttons and Back, one URL per section, the This computer breadcrumb, and each section's own controls. Desktop omits Disconnect this browser; browser detail includes it. The listed spec covers desktop navigation. The browser map covers the same navigation in web mode.
