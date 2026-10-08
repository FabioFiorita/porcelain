---
selectors:
  - open-project
  - 'Open Project…'
  - porcelain:pick-project-folder
  - 'Open project'
tests:
  - apps/desktop/spec/e2e/folder-picker.e2e.ts
api: []
---

# projects.folder-picker

## What it is

The Mac app opens a project through the native folder sheet instead of the web's folder browser. The File menu's Open Project item and the Open project button both ask the main process for one folder, attached to the app window, starting in the project home; a chosen Git repository becomes a project, and a cancel registers nothing. The web never browses or discovers folders on the server in the desktop.

## How a user reaches it

- File › Open Project… (⌘O)
- the Open project button in the sidebar, including when no project is registered

## Driving it

Start a disposable instance and read `connection.json`. The sample repository is `fixtures.repositoryPath`. The launcher leaves `dialog.showOpenDialog` intact, so the sheet is real.

1. With Computer Use, choose File › Open Project… (then repeat using ⌘O). Inspect the sheet attached to Porcelain Dev: title and button “Open project”, directory the sample repository. Cancel and confirm no project was registered.
2. Click the sidebar's Open project button. Select the sample Git repository in the real sheet and confirm with Open project. Observe `desktop-smoke` in the sidebar; open it and inspect History.
3. Use a renderer request observer or the browser network tools to confirm no request to `/api/projects/folders` occurred. Read `/api/inventory` through the app renderer to confirm the chosen repository was registered.

Save screenshots of the real sheet and resulting sidebar in the card's evidence directory. The raw Playwright Electron handle can prove the bridge options in an in-process journey; only the existing regression tests substitute picker answers. If Computer Use is unavailable, report bridge proof separately and leave real-sheet assurance open.

## What proves it works

- `apps/desktop/spec/e2e/folder-picker.e2e.ts` (Playwright Electron): the menu opens the sheet with the exact options and no dialog before it, a cancel registers nothing, the button registers the chosen repository with no folder browsing, and the app then serves its history and live file changes.

## Gotchas

- A real sheet blocks the picker promise until someone chooses a folder or cancels it. The launcher never intercepts it.
- A CDP renderer connection cannot operate the native OS sheet. Use Computer Use; keep bridge-only evidence distinct when that tool is unavailable.
