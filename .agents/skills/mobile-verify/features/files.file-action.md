---
screen: /file-action
selectors:
  - 'New file'
  - 'New folder'
  - 'Rename'
  - 'file-action-path'
  - 'file-action-submit'
  - 'Action unavailable'
tests: []
api:
  - POST /api/worktrees/:worktreeId/files
---

# files.file-action

New file, New folder and Rename open as a form sheet route over Files, holding one path field and the primary Create or Rename button. Move to trash is a platform alert instead, because it is a title, a message and two buttons.

## How to get to it (user POV)

- Files → header + (Create file or folder) → New file or New folder.
- Files → hold a row → Rename, or Move to trash.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open New file. Expect the sheet over the tab bar with the title and an X (Close); there is no Cancel button. Close, then reopen and swipe down: no disk change.
2. Fill `file-action-path` and press `file-action-submit`: the sheet closes, the new file opens in the same tab stack, and it exists in `REPO`. A folder is created without opening.
3. Hold a row → Rename with the full relative path; the sheet closes and the disk shows the move. A failure keeps the sheet open and retryable.
4. Hold a row → Move to trash: the alert names the path. Cancel leaves it; Move to trash removes it from `REPO`, and a failure shows its reason above the tree.

## Gotchas

- The sheet carries the workspace key; if another worktree is selected meanwhile it says Workspace changed instead of editing the wrong checkout.
