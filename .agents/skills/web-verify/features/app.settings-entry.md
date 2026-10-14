---
route: /settings
selectors:
  - "Settings"
  - "Settings sections"
  - "Appearance"
  - "This computer"
  - "Back"
tests:
  - apps/web/spec/e2e/app-routing.e2e.ts
  - apps/web/spec/e2e/app-routing.desktop.e2e.ts
api:
  - GET /api/inventory
---

# app.settings-entry

Direct navigation to `/settings` replaces that entry with the default Settings section: `/settings/appearance` in web mode, `/settings/computer` in desktop mode. Observe main Settings, navigation Settings sections and the corresponding section heading. Back returns to the prior page or the workspace when there is no prior entry.

Start one web instance, pair and navigate to `/settings`. Repeat with `start --desktop` after stopping the first instance. The named specs cover both defaults. Unknown sections follow [app.not-found](app.not-found.md).
