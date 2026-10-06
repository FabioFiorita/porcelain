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

Start with `.agents/skills/desktop-verify/scripts/cli start`. Bind CUA to the reported running development bundle and confirm its PID. Read the sample repository path and preserve the real OS sheet; no picker response is injected.

### Sidebar cancellation registers nothing

1. Read the empty window in CUA. Look for “No projects registered” and the sidebar's Open project button.
2. Click Open project. Read the actual macOS folder sheet attached to this app, with its folder browser and Open project/Cancel controls. No web folder browser should appear first.
3. Click the sheet's native Cancel. Read the window again: the sheet is gone, “No projects registered” remains and no project was added.

### The File menu selects the supplied repository

1. Through CUA, open the native File menu and select Open Project…. Observe the real sheet directly.
2. In the sheet, navigate to the exact repository printed by `start` using the native folder browser or Go to Folder. Confirm that directory is selected and click the native Open project control.
3. Look for `desktop-smoke` in the sidebar with the printed repository path and its `main` worktree. Open that worktree and its History tab with CUA or the optional exact-CDP renderer recipe in the skill.
4. Look for the real seed commit “Create smoke project”, its actual abbreviated Git hash, author “Desktop proof”, branch `main` and “Start of history.” Compare the displayed hash with `git -C <repository> rev-parse --short HEAD`.

### The native accelerator also opens a cancellable sheet

Focus the exact native development window through CUA and press ⌘O. Observe the actual folder sheet, then click native Cancel. The registered project remains once, with the same path/worktree; History still loads its seed commit. A renderer key command accepted over CDP is not accelerator evidence.

Keep native sheet captures and renderer results with the launcher evidence. The automated regression supplies the exact picker options and absence of `/api/projects/folders` requests; a screenshot alone cannot prove that transport promise.

## What proves it works

- The CUA journey above establishes actual sidebar/menu/accelerator sheet opening, native cancellation and native folder selection followed by real History.
- `apps/desktop/spec/e2e/folder-picker.e2e.ts` (Playwright Electron) intercepts the picker in its fixture: the menu callback requests the app-owned sheet with title/button “Open project”, the sample repository as default and `openDirectory`; a supplied cancel registers nothing; the button registers the supplied repository with no server folder-browsing requests; real History and live file changes load. This proves request/options and bridge registration, not physical menu or OS-sheet selection.

Run the focused regression when this feature changes:

```sh
pnpm --filter @porcelain/desktop exec playwright test spec/e2e/folder-picker.e2e.ts
```

## Gotchas

- Native Cancel must dismiss the actual sheet. Renderer Escape and browser JS-dialog status can return success or “no dialog” while the OS sheet remains.
- A supplied path is not a native selection until the OS sheet shows it selected and its Open project control is used.
- Reinspect native state after a menu or accelerator action. An About dialog or an unchanged window does not count as picker success; record the failure and any recovery separately.
