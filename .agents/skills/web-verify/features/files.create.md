---
route: /
selectors:
  - "All files"
  - "Review"
  - "Worktree review"
  - "Files"
  - "Create file or folder"
  - "New file"
  - "New folder"
  - "Rename"
tests:
  - apps/web/spec/integration/files-create.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - POST /api/worktrees/:worktreeId/files
---

# files.create

New file and New folder create an entry through an inline tree field; a created file opens immediately, while a folder leaves the tree open.

## How to get to it (user POV)

- Review (phone width; opens the sheet "Worktree review") → tab Files → button "Create file or folder" (+) in the panel header → menuitem "New file" or "New folder". These create at the worktree root.
- Right-click a folder row in the tree → menuitem "New file" or "New folder": creates inside that folder.
- Keyboard: `Alt+Shift+R` opens the review sheet at phone width, `Alt+1` selects the Files tab.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Preconditions: phone width. Remove prior `phone-created.md`/`phone-folder` fixture entries before repeating.

1. Open `/` → Review → Files. Expect Worktree review, selected Files, Search files, Create file or folder and Collapse all, with README.md in All files.
2. Focus Search files, then Shift+Tab three times (the Files panel, Collapse all, Create file or folder in the header): Create file or folder has focus. Enter opens New file (focused) and New folder. Escape closes the menu/restores trigger focus; Enter reopens, Enter selects New file.
3. Expect focused Rename untitled with selected default name. Type `phone-created.md` immediately, then Enter. Sheet closes; heading/title names phone-created.md. Independently check `wc -c < "$REPO/phone-created.md"` is 0.
4. Reopen Review: Files retains selection and the new row. Search files → Shift+Tab three times → Enter → ArrowDown focuses New folder; Enter opens focused Rename new-folder. Type `phone-folder`, Enter: sheet stays and All files contains the folder. `test -d "$REPO/phone-folder"` succeeds.
5. Drive both New file/New folder from a folder row context menu: entries are created inside that folder. A nested file heading uses its full relative path; the browser title uses its basename. Cancel an inline name with Escape: no entry remains. Check invalid/duplicate names using Gotchas.
6. Inspect 2xx file-creation POSTs, reload `/` and reopen Files: created entries persist on disk/tree.

Automated coverage: `files-create.test.tsx`.

## Gotchas

- Name fields commit on blur, even with the default name; Escape cancels. Invalid names show Invalid name in Notifications: `/` gives `Name cannot include "/".`; duplicates give `"phone-created.md" already exists.` Invalid submission removes the inline row and keeps the sheet open; do not press Escape afterward unless closing the sheet.
- Existing untitled/new-folder paths change defaults to untitled-2/new-folder-2: match `/^Rename /`. The + trigger disables during writes.
