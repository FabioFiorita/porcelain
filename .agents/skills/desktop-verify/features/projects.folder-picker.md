---
selectors:
  - open-project
  - 'Open Project…'
  - porcelain:pick-project-folder
  - 'Open project'
tests:
  - apps/web/spec/e2e/projects-reconnect.desktop.e2e.ts
  - apps/desktop/spec/e2e/folder-picker.e2e.ts
api: []
---

# projects.folder-picker

The desktop app opens a project through its native folder picker instead of the web's folder browser. On macOS it is a sheet attached to the window.

## How to get to it (user POV)

- File › Open Project… (⌘O)
- the Open project button in the sidebar, including when no project is registered

## Driving it with Electron

Preconditions: [surface baseline](README.md).

The `portable` regression exercises the sidebar and menu bridge with substituted cancel/selection answers on Linux or macOS, independently reads inventory, and verifies history and live file updates. It does not observe the real native picker. The following real-sheet journey requires macOS and an OS driver that can operate that sheet.

1. Use Computer Use for File → Open Project…, then ⌘O. Expect the real sheet attached to Porcelain Dev, titled “Open project”, with an Open project button and the sample repository directory. Cancel; `/api/inventory` through the renderer shows no project registered.
2. Click sidebar Open project. Choose `REPO` in the sheet and confirm. Expect `desktop-smoke` in the sidebar; open it and inspect History.
3. Read `/api/inventory` again: it contains the chosen repository. Observe requests throughout: no `/api/projects/folders` request occurs. Retain sheet and resulting-sidebar screenshots.

Automated coverage: `folder-picker.e2e.ts`.

## Gotchas

- A real sheet waits until a folder is chosen or Cancel is pressed. CDP cannot operate it; use Computer Use.
- Substituted picker answers in the named regression prove bridge behavior separately from an observed real sheet.
- After the first registration, wait for the destination's Review tab before using the project cards or Filter worktrees. The URL changes before that route renders, and navigation replaces the first-run sidebar and any menu opened on it. Wait for Review after reload as well.

## Replaced repository recovery

The native picker, File → Open Project… and its keyboard shortcut use the same registration command. When the chosen folder has a replacement Git identity, selecting it offers `Reconnect <original project name>` in the renderer instead of adding a second project or navigating to its old saved data. Capture the confirmation and cancel once; inventory must still contain one original project and its old worktrees remain unavailable. Confirm Reconnect and verify the same project id/name with fresh current worktree ids and review marks. Sidebar Reconnect / Choose folder and project-menu Reconnect project reach that same confirmation; recovery folder browsing runs on the project's server. Exercise remote recovery with the web feature map on the selected remote.

Follow the isolated `.git` replacement and restoration recipe in the web `projects.open-folder` map, and retain before/after sidebar plus confirmation images. Native picker substitution proves the bridge entry path only; record a separate real sheet observation when using the macOS picker. No installed profile or user repository participates.

A confirmed reconnect opens the replacement worktree before dismissing the dialog. The route must contain its new worktree id and show Changes; it must not remain on Worktree not found. Cancellation leaves the original unavailable binding unchanged. The named desktop-mode reconnect regression covers this navigation and return behavior.
