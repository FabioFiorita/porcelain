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

Start an instance first: `.agents/skills/desktop-verify/scripts/cli start`. It prints the sample repository; the picker is held, so a sheet the app opens waits for `dialog` instead of showing.

### The menu opens the sheet directly, and a cancel registers nothing

```sh
.agents/skills/desktop-verify/scripts/cli menu "File/Open Project…"
.agents/skills/desktop-verify/scripts/cli dialog --cancel
.agents/skills/desktop-verify/scripts/cli snapshot
```

After `dialog --cancel`, look for: one picker request with `ownerIsAppWindow: true`, title and button label “Open project”, `defaultPath` the sample repository and `properties: ["openDirectory"]`, answered with the cancel. The snapshot shows no dialog and the Open project button still there.

### The button opens the chosen repository as a project

```sh
.agents/skills/desktop-verify/scripts/cli click --role button --name "Open project"
.agents/skills/desktop-verify/scripts/cli dialog <repository>
.agents/skills/desktop-verify/scripts/cli snapshot
.agents/skills/desktop-verify/scripts/cli network
```

After the snapshot, look for: a `desktop-smoke` button in the sidebar. `network` lists no request to `/api/projects/folders`.

## What proves it works

- `apps/desktop/spec/e2e/folder-picker.e2e.ts` (Playwright Electron): the menu opens the sheet with the exact options and no dialog before it, a cancel registers nothing, the button registers the chosen repository with no folder browsing, and the app then serves its history and live file changes.

## Gotchas

- `dialog <folder>` answers the sheet that is waiting, or the next one the app opens; `dialog` alone records every request so far.
- A real sheet never shows during verification; driving the picker without `dialog` leaves the app waiting for an answer.
