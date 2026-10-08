---
route: /
selectors:
  - "All files"
  - "Review"
  - "Worktree review"
  - "Files"
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

## What it is

New file and New folder add a row to the file tree with an inline name field; Enter creates the named entry on disk. A new file opens at once, a new folder does not.

## How a user reaches it

- Review (phone width; opens the sheet "Worktree review") → tab Files → button "New file" or button "New folder" beside "Search files". These create at the worktree root.
- Right-click a folder row in the tree → menuitem "New file" or "New folder": creates inside that folder.
- Keyboard: `Alt+Shift+R` opens the review sheet at phone width, `Alt+1` selects the Files tab.

## Driving it

Start with `$C start`; pair your browser using the card’s pairing-link command. Set `REPO` to `fixtures.repositoryPath` in the card’s `connection.json`.

### Setup

None. Before you drive again on the same instance, remove what the last run made: `rm -rf "$REPO/phone-created.md" "$REPO/phone-folder"`.

### Steps

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Changes — repository" and button "Review".
2. Click button named `Review`
   Look for: dialog "Worktree review" with tabs "Files", "Changes" and "History".
3. Click tab named `Files`
   Look for: tab "Files" [selected], textbox "Search files", buttons "New file" and "New folder", the tree in region "All files" with treeitem "README.md".
4. Click button named `New file`
   Look for: a new tree row holding textbox "Rename untitled" (its value is `untitled`).
5. Replace the contents of textbox named `/^Rename /` with 'phone-created.md'
   Look for: the textbox now holds `phone-created.md`.
6. Press `Enter`
   Look for: dialog "Worktree review" is gone; heading "phone-created.md" [level=1]; Page Title "phone-created.md — repository".
   Disk: `ls "$REPO"` lists `phone-created.md`, and `wc -c < "$REPO/phone-created.md"` prints `0`.
7. Click button named `Review`
   Look for: dialog "Worktree review" opens with tab "Files" still selected and treeitem "phone-created.md" in the tree.
8. Click button named `New folder`
   Look for: textbox "Rename new-folder".
9. Replace the contents of textbox named `/^Rename /` with 'phone-folder'
   Look for: the textbox holds `phone-folder`.
10. Press `Enter`
    Look for: the dialog stays open (a folder does not open) and treeitem "phone-folder" shows in the tree of region "All files".
    Disk: `test -d "$REPO/phone-folder" && echo folder` prints `folder`.
11. Inspect HTTP requests and responses
    Look for: two `POST /api/worktrees/<worktreeId>/files` requests with a 2xx status.

## What proves it works

- On disk: `$REPO/phone-created.md` exists and is empty, `$REPO/phone-folder` is a directory (steps 6 and 10).
- a full reload of `/`, then Review → Files, still shows treeitems "phone-created.md" and "phone-folder", because the tree lists the directory from the server.
- `apps/web/spec/integration/files-create.test.tsx` runs the same steps at phone width. It asserts that the server's root directory lists `phone-created.md`, that the sheet "Worktree review" closes after the file is created, and that the root then lists `phone-folder`.

## Gotchas

- At phone width the Files tree lives in the sheet behind button "Review". Opening any document closes the sheet, so click "Review" again before the next tree action. Actions that open nothing (a new folder) leave the sheet open, and the "Review" button behind it cannot be clicked then.
- The name field commits on blur when it still holds the default name. A click elsewhere while it shows `untitled` or `new-folder` creates that entry. `Escape` cancels and removes the row.
- The tree refuses some names before any request is sent, and shows the toast "Invalid name" in region "Notifications". This happens for a name holding `/` (`Name cannot include "/".`) and for a name already in that folder (`"phone-created.md" already exists.`). Running the steps twice without the reset above hits the second case.
- When `untitled` already exists, the default name becomes `untitled-2` (`new-folder-2` for folders), so match the textbox with `/^Rename /`, not the exact name.
- The buttons are disabled while a file write is pending.
