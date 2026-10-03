---
route: /
selectors:
  - "Review"
  - "Worktree review"
  - "Files"
  - "Duplicate"
tests:
  - apps/web/spec/e2e/files-duplicate.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/directory
  - POST /api/worktrees/:worktreeId/files
---

# files.duplicate

## What it is

Duplicating a file writes a copy beside it, named `<stem> copy<extension>` (then `<stem> copy 2<extension>` and so on), and opens the copy. It runs from the file's menu, or with Mod+D on the open file.

## How a user reaches it

- Review (phone width) → tab Files → right-click a file row → menuitem "Duplicate".
- Review → tab Files → right-click a row under "Pinned" → menuitem "Duplicate".
- `Mod+D` (`ControlOrMeta+d` in the CLI) duplicates the file open as a file document while the Files tree is mounted.

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start`. Set `REPO` to the path it prints after `repository`.

### Setup

Before `open`:

```sh
printf 'Notes to copy\n' > "$REPO/notes.md"
```

### Steps

1. `.agents/skills/web-verify/scripts/cli open /`
   Look for: Page Title "Changes — repository".
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: dialog "Worktree review".
3. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: tab "Files" [selected], with treeitem "notes.md" and treeitem "README.md" in the tree of region "All files".
4. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "notes.md" --button right`
   Look for: a menu with menuitems "Rename", "Duplicate", "Open diff", "Open file", "Show timeline", "Pin file", "Hide file", "Copy relative path", "Copy full path", "Move to trash".
5. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Duplicate"`
   Look for: dialog "Worktree review" is gone; heading "notes copy.md" [level=1]; Page Title "notes copy.md — repository".
   Disk: `cat "$REPO/notes copy.md"` prints `Notes to copy`, and `cat "$REPO/notes.md"` still prints `Notes to copy`.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: dialog "Worktree review" with tab "Files" selected and treeitem "notes copy.md" (selected) in the tree.
7. `.agents/skills/web-verify/scripts/cli press ControlOrMeta+d`
   Look for: the dialog is gone; Page Title "notes copy copy.md — repository"; heading "notes copy copy.md" [level=1].
   Disk: `ls "$REPO"` lists `notes copy copy.md`.
8. `.agents/skills/web-verify/scripts/cli network`
   Look for: two `POST /api/worktrees/<worktreeId>/files` requests with a 2xx status.

## What proves it works

- On disk: `notes copy.md` and `notes copy copy.md` hold the original's text, and `notes.md` is unchanged.
- The Page Title names the copy after each duplicate, which shows the copy opened.
- `apps/web/spec/e2e/files-duplicate.e2e.ts` duplicates `notes.md` from its menu. It asserts that the server lists `notes copy.md` with the same text, that the original keeps its text, and that the title becomes `notes copy.md — <project>`. It then presses `ControlOrMeta+d` with the Files tab showing and asserts `notes copy copy.md` exists and its title shows.

## Gotchas

- Mod+D is registered by the Files tree itself. At phone width it works only while the sheet "Worktree review" is open on tab Files (step 6). With the sheet closed nothing happens.
- Mod+D duplicates only a file open as a **file** document (the Page URL's `entry` starts with `file:`). Clicking an untracked or changed file in the tree opens its diff instead (`entry` starts with `change:`), and Mod+D then does nothing. A file opened by Duplicate, by quick open or by the menu's "Open file" counts as a file document.
- Mod+D is ignored while focus is in a text field such as "Search files".
- Running the steps again on the same instance makes `notes copy 2.md`, because `notes copy.md` already exists. Reset with `rm -f "$REPO"/notes\ copy*.md`.
