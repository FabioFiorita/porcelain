---
route: /
selectors:
  - "Review"
  - "Worktree review"
  - "Files"
  - "Duplicate"
tests:
  - apps/web/spec/integration/files-duplicate.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - POST /api/worktrees/:worktreeId/files
---

# files.duplicate

Duplicating a file writes a copy beside it, named `<stem> copy<extension>` (then `<stem> copy 2<extension>` and so on), and opens the copy. It runs from the file's menu, or with Mod+D on the open file.

## How to get to it (user POV)

- Review (phone width) → tab Files → right-click a file row → menuitem "Duplicate".
- Review → tab Files → right-click a row under "Pinned" → menuitem "Duplicate".
- `Mod+D` (`ControlOrMeta+d` with the browser driver) duplicates the file open as a file document while the Files tree is mounted.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

Before a full page load:

```sh
printf 'Notes to copy\n' > "$REPO/notes.md"
```

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Review`
   Expect: dialog "Worktree review".
3. Click tab `Files`
   Expect: tab "Files" [selected], with treeitem "notes.md" and treeitem "README.md" in the tree of region "All files".
4. Right-click treeitem `notes.md`
   Expect: a menu with menuitems "Rename", "Duplicate", "Open diff", "Open file", "Show timeline", "Pin file", "Hide file", "Copy relative path", "Copy full path", "Move to trash".
5. Click menuitem `Duplicate`
   Expect: dialog "Worktree review" is gone; heading "notes copy.md" [level=1]; title "notes copy.md — repository".
   Disk: `cat "$REPO/notes copy.md"` prints `Notes to copy`, and `cat "$REPO/notes.md"` still prints `Notes to copy`.
6. Click button `Review`
   Expect: dialog "Worktree review" with tab "Files" selected and treeitem "notes copy.md" (selected) in the tree.
7. Press `ControlOrMeta+d`
   Expect: the dialog is gone; title "notes copy copy.md — repository"; heading "notes copy copy.md" [level=1].
   Disk: `ls "$REPO"` lists `notes copy copy.md`.
8. Inspect HTTP traffic
   Expect: two `POST /api/worktrees/<worktreeId>/files` requests with a 2xx status.

### Observable proof

Read all copies and original independently: copies retain original text and each newly opened copy sets the title.

Automated coverage: `files-duplicate.test.tsx`.

## Gotchas

- Mod+D requires focus outside editable fields, an open Files tree (phone sheet), and a file document (`entry=file:`), not a changed-file diff (`entry=change:`). Duplicate, quick-open and Open file produce file documents.
- Repeated runs choose notes copy 2.md. Reset with `rm -f "$REPO"/notes\ copy*.md`.
