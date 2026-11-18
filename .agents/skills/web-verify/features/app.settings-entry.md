---
route: /settings
selectors:
  - 'Toggle Sidebar'
  - 'Settings'
  - 'Settings sections'
  - 'General'
tests:
  - apps/web/spec/e2e/app-settings-page.desktop.e2e.ts
  - apps/web/spec/integration/settings-preferences.test.tsx
api: []
---

# app.settings-entry

Open Settings from the workspace sidebar or Alt+Shift+S.

## How to get to it (user POV)

- Workspace sidebar → Settings; Alt+Shift+S; native Settings menu. `/settings` opens General.

## Driving it with browser

Preconditions: [surface baseline](README.md).

The Mac app also dispatches Settings from its native menu. Each entry uses `/settings/general`, regardless of shell. Settings opens as a dialog over the workspace, which stays mounted behind it, and records its return history; links into a section (Manage computers, a computer's outage notice) open the same dialog at that section. Every global section and computer detail uses Settings — Porcelain as the document/window title, independent of the selected project or computer name. Close (×), Escape, a click outside the dialog and browser Back leave Settings and return focus to the control that opened it; Escape in an input is ignored. A `/settings/...` address opened directly, with no workspace before it, shows Settings over the workspace home, and leaving it opens the workspace as `/` does. Computer detail has a breadcrumb back to Computers.

Open the sidebar (Toggle Sidebar below 768px), click Settings and verify heading General and the three sections. Switch sections and click Close in the dialog header: the original workspace URL and title return without the review reloading. Repeat with Alt+Shift+S, Escape, a click outside and browser Back. The native menu entry requires the parent desktop surface proof; this web map does not claim that it ran.

Automated coverage: `app-settings-page.desktop.e2e.ts`.

## Gotchas

- Test direct entry and in-app entry separately: their return history differs.
