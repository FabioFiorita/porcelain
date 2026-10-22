---
route: /settings
selectors:
  - 'Toggle Sidebar'
  - 'Settings'
  - 'Settings sections'
  - 'General'
tests:
  - apps/web/spec/e2e/app-settings-page.desktop.e2e.ts
api: []
---

# app.settings-entry

Open Settings from the workspace sidebar or Alt+Shift+S.

## How to get to it (user POV)

- Workspace sidebar → Settings; Alt+Shift+S; native Settings menu. `/settings` opens General.

## Driving it with browser

Preconditions: [surface baseline](README.md).

The Mac app also dispatches Settings from its native menu. Each entry uses `/settings/general`, regardless of shell. Settings replaces the workspace and records its return history. Close or Escape leaves the top-level section; Escape in an input is ignored. Computer detail has a breadcrumb back to Computers.

Open the sidebar (Toggle Sidebar below 768px), click Settings and verify heading General and the three sections. Switch sections and click Back: the original workspace URL and title return. Repeat with Alt+Shift+S. The native menu entry requires the parent desktop surface proof; this web map does not claim that it ran.

Automated coverage: `app-settings-page.desktop.e2e.ts`.

## Gotchas

- Test direct entry and in-app entry separately: their return history differs.
