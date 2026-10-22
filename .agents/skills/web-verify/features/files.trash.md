---
route: /
selectors:
  - "Review"
  - "Worktree review"
  - "Files"
  - "Move to trash"
  - "Cancel"
tests:
  - apps/web/spec/integration/files-trash.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - POST /api/worktrees/:worktreeId/files
---

# files.trash

Moving a file to the trash from the tree, after a confirmation, moves it to the system trash and removes it from the tree. Trashing a file another writer already removed is refused, and the dialog says "Path not found".

## How to get to it (user POV)

- Review (phone width) → tab Files → right-click a row → menuitem "Move to trash" → alertdialog "Move <name> to the trash?" → button "Move to trash".
- Review → tab Files → right-click a row under "Pinned" → menuitem "Move to trash".

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

Before a full page load:

```sh
printf 'Notes to throw away\n' > "$REPO/old-notes.md"
printf 'Notes another writer removes\n' > "$REPO/gone-notes.md"
```

On Linux the sandboxed server keeps its XDG data home in the instance folder, so the trash is `$REPO/../data/Trash` (`info/*.trashinfo` names the original path, `files/` holds the content).

### 1. Trash removes the file

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Review`
   Expect: dialog "Worktree review".
3. Click tab `Files`
   Expect: treeitems "old-notes.md" and "gone-notes.md" in the tree of region "All files".
4. Right-click treeitem `old-notes.md`
   Expect: a menu whose last menuitem is "Move to trash".
5. Click menuitem `Move to trash`
   Expect: alertdialog "Move old-notes.md to the trash?" with buttons "Cancel" and "Move to trash". The file is untracked, so the description begins "This is part of the agent’s changes."
6. Click button `Move to trash`
   Expect: the alertdialog is gone and treeitem "old-notes.md" is gone; the sheet stays open.
   Disk: `test -e "$REPO/old-notes.md" || echo gone` prints `gone`; `grep -l 'old-notes.md' "$REPO"/../data/Trash/info/*.trashinfo` prints one file. The content sits under `$REPO/../data/Trash/files/`.

### 2. Trashing a file already removed is refused

7. Right-click treeitem `gone-notes.md`
   Expect: the menu opens.
8. Click menuitem `Move to trash`
   Expect: alertdialog "Move gone-notes.md to the trash?".
9. With the dialog open, remove the file on disk: `rm "$REPO/gone-notes.md"`.
10. Click button `Move to trash`
    Expect: inside the alertdialog, an alert reading "Path not found"; the dialog stays open.
11. Click button `Cancel`
    Expect: the alertdialog is gone; treeitem "README.md" still shows.
    Disk: `test -e "$REPO/README.md" && echo kept` prints `kept`.
12. Inspect HTTP traffic
    Expect: `POST /api/worktrees/<worktreeId>/files` with a 2xx status (step 6), then one with an error status (step 10).

### Observable proof

Read removed path and instance `.trashinfo`; original path is recorded. Refused trash leaves README untouched; reload omits old-notes.md.

Automated coverage: `files-trash.test.tsx`.

## Gotchas

Trash opens nothing, so the sheet stays open between parts 1 and 2. Do not click "Review" while it is open.
- Two elements read "Move to trash": the menu's menuitem and the dialog's button. Keep the role in the address.
- In part 2 the server checks the disk itself when you confirm, so no watcher delay matters after the `rm`.
- On macOS the sandbox sets `TRASH_FALLBACK=1`, and the trash location differs from the Linux path above.
