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

The Mac app opens a project through the native folder sheet instead of the web's folder browser.

## How to get to it (user POV)

- File › Open Project… (⌘O)
- the Open project button in the sidebar, including when no project is registered

## Driving it with Electron

Preconditions: [surface baseline](README.md).

1. Use Computer Use for File → Open Project…, then ⌘O. Expect the real sheet attached to Porcelain Dev, titled “Open project”, with an Open project button and the sample repository directory. Cancel; `/api/inventory` through the renderer shows no project registered.
2. Click sidebar Open project. Choose `REPO` in the sheet and confirm. Expect `desktop-smoke` in the sidebar; open it and inspect History.
3. Read `/api/inventory` again: it contains the chosen repository. Observe requests throughout: no `/api/projects/folders` request occurs. Retain sheet and resulting-sidebar screenshots.

Automated coverage: `folder-picker.e2e.ts`.

## Gotchas

- A real sheet waits until a folder is chosen or Cancel is pressed. CDP cannot operate it; use Computer Use.
- Substituted picker answers in the named regression prove bridge behavior separately from an observed real sheet.
- After the first registration, wait for the destination's Changes tab before using the project cards or Filter worktrees. The URL changes before that route renders, and navigation replaces the first-run sidebar and any menu opened on it. Wait for Changes after reload as well.
