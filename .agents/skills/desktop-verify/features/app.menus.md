---
selectors:
  - open-settings
  - open-project
  - 'Settings…'
  - togglefullscreen
  - 'This build updates by reinstalling; there is no update feed yet.'
tests:
  - apps/desktop/spec/e2e/menus.e2e.ts
  - apps/desktop/spec/e2e/folder-picker.e2e.ts
api: []
---

# app.menus

The Mac app's application menu: Porcelain (About, Settings… with ⌘,, Services, Hide, Quit), File (Open Project… with ⌘O, Close Window), Edit, View and Window.

## Sub-features

- `app.menus` — Settings, project, zoom and full-screen menus.

## How to get to it (user POV)

- the menu bar, or ⌘, for Settings and ⌘O for Open Project

## Driving it with Electron

Preconditions: [surface baseline](README.md).

1. Through Computer Use, choose Porcelain Dev → Settings…, then repeat with ⌘,. Expect Settings, app version and the reinstall message under Computers → This computer.
2. In an in-process Electron journey, inspect `Menu.getApplicationMenu()` through `electron.evaluate`. View contains `resetZoom`, `zoomIn`, `zoomOut`, `togglefullscreen`; no `reload`, `forceReload` or `toggleDevTools`. Invoke `open-settings` and confirm Settings in `electron.firstWindow()`.
3. Drive File → Open Project… and ⌘O through [folder picker](projects.folder-picker.md). An action sent before the renderer is ready must still open its destination.

Automated coverage: `menus.e2e.ts`, `folder-picker.e2e.ts`.

## Gotchas

- Reload/Developer Tools are available only in an unpackaged Vite development run (`pnpm dev --desktop`); the verification app has neither.
- Native menu roles and keyboard dispatch require macOS.
