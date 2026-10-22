---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Find in file"
tests:
  - apps/web/spec/integration/files-find-refresh.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
---

# files.find-refresh

When the open file changes on disk while the find bar is open, the file view shows the new text and the match count is recomputed on it, never naming a match past the new last one.

## Sub-features

- `files.find-refresh` — Search refresh after filesystem changes.

## How to get to it (user POV)

- Review → Files → right-click a changed file → Open file → `Mod+F` (find shortcut), while another writer changes the file on disk.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

```sh
printf 'needle one\nneedle two\nneedle three\n' > "$REPO/notes.txt"
```

A second write happens between steps 4 and 5.

1. Navigate to `/`, click button `Review`, click tab `Files`
   Expect: treeitem "notes.txt".
2. Right-click treeitem `notes.txt`, then click menuitem `Open file`
   Expect: tab "notes.txt Close notes.txt" selected; the code shows "needle one", "needle two", "needle three".
3. Press `ControlOrMeta+f`, then replace the contents of textbox named `Find in file` with 'needle'
   Expect: status "1 of 3".
4. Press `Enter`, then press `Enter`
   Expect: status "2 of 3" after the first, "3 of 3" after the second.
5. On disk: `printf 'needle only\n' > "$REPO/notes.txt"`, then inspect the accessibility tree
   Expect: the code shows "needle only" and no longer "needle three"; textbox "Find in file" still holds "needle"; status "1 of 1" (not "3 of 1").
6. Inspect HTTP traffic
   Expect: a second `GET /api/worktrees/<id>/text?path=notes.txt` answered 200 after the disk write.

### Observable proof

After external write, result count clamps to 1 of 1 without reload; record the triggered refetch.

Automated coverage: `files-find-refresh.test.tsx`.

## Gotchas

- The new text arrives through the server's file watcher and a live update; give it a moment and take Inspect the accessibility tree again if it still shows the old lines.
- replacing the field contents leaves focus in "Find in file", which is where `Enter` must land to step; `Enter` anywhere else does not step.
- A single click on `notes.txt` (untracked, so a change) opens its diff, not the file; use the tree menu's "Open file".
