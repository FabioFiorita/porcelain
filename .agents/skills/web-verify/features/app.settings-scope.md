---
route: /settings/$section
shell: desktop
selectors:
  - 'Settings'
  - 'Settings sections'
  - 'General'
  - 'Reviews & Git'
  - 'Computers'
  - 'Documents open as'
  - 'Agent'
  - 'Pair a device'
  - 'Open This computer:'
  - 'Ways in'
  - 'Local network'
tests:
  - apps/web/spec/e2e/app-settings-scope.desktop.e2e.ts
  - apps/web/spec/e2e/app-settings-documents.e2e.ts
  - apps/web/spec/e2e/app-settings-model.desktop.e2e.ts
api:
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# app.settings-scope

Desktop and browser show the same three sections in this order: General, Reviews & Git, Computers. General is the default. No About or search section exists. The muted sidebar footer shows the app version and Esc to close.

## How to get to it (user POV)

- Workspace sidebar → Settings; choose General, Reviews & Git or Computers.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Start a desktop verification instance, pair the browser, open the workspace sidebar and click Settings. The URL is `/settings/general`; the page replaces the workspace. Click Computers, then Open This computer: <name>: `/settings/computers/this-computer` shows its name, connection, app or service updater, and Ways in. Local network, Tailscale and Cloudflare tunnel stay in that detail, rather than separate settings destinations. Do not change route switches during this navigation check.

This computer also shows Pair a device and Paired devices for a host-authorized browser, then Agents with the Claude Code / Codex switch and copyable Porcelain MCP command. A failed desktop configuration read offers Retry MCP configuration. Old `/settings/devices` and `/settings/integrations` links redirect here. Click Reviews & Git: Spec files, pull strategy and archive toggles appear, saved on the computer for every device connected to it ([details](preferences.reviews-git.md)). There is no Commit model setting: the commit dialog picker remembers its last choice after reload. General has one Documents open as choice for Markdown and HTML. A legacy Source choice for either format migrates to Source; a later Rendered selection persists and removes both old keys.

Automated coverage: `app-settings-scope.desktop.e2e.ts`.

## Gotchas

- This computer has different controls for host permission and browser disconnect; desktop mode alone does not grant host permission.
