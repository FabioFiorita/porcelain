---
route: /
selectors:
  - "Review"
  - "Worktree review"
  - "Files"
  - "Change no longer present"
tests:
  - apps/web/spec/integration/files-move.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - POST /api/worktrees/:worktreeId/files
---

# files.move

Dragging a file onto a folder in the tree moves it into that folder on disk without opening it. Dragging a file onto a folder that already holds that name is refused, says so, and keeps both files.

## Sub-features

- `files.move` — Move entries and verify their destinations.

## How to get to it (user POV)

- Review (phone width) → tab Files → drag a tree row onto a folder row (a mouse drag, or on touch a 400 ms long-press then drag).
- There is no other path: no menu item, no keyboard move. Rename cannot move an entry either, because the tree refuses a name holding `/` (`Name cannot include "/".`).

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

Before a full page load:

```sh
mkdir "$REPO/archive"
printf 'Already in the folder\n' > "$REPO/archive/clash.md"
printf 'Notes to move\n' > "$REPO/move-me.md"
printf 'Notes that clash\n' > "$REPO/clash.md"
```

For the move, press on the source row, moves onto the target row and releases there, as a mouse would.

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Review`
   Expect: dialog "Worktree review".
3. Click tab `Files`
   Expect: the tree in region "All files" with treeitems "archive" (a collapsed folder), "clash.md", "move-me.md" and "README.md".
4. Drag treeitem named `move-me.md` onto treeitem named `archive`
   Expect: treeitem "move-me.md" is gone from the root, dialog "Worktree review" stays open, and no text "Change no longer present" appears.
   Disk: `ls "$REPO/archive"` prints `clash.md` and `move-me.md`; `test -e "$REPO/move-me.md" || echo moved` prints `moved`.
5. Drag treeitem named `clash.md` onto treeitem named `archive`
   Expect: alert "An entry already exists at that path" under the tree, and treeitem "clash.md" still at the root.
   Disk: `cat "$REPO/clash.md"` prints `Notes that clash`, and `cat "$REPO/archive/clash.md"` prints `Already in the folder`.

### Observable proof

Disk shows moved file only in archive; refused clash preserves both texts. File POSTs answer 200 and 409 respectively.

Automated coverage: `files-move.test.tsx`.

## Gotchas

- A folder cannot be dropped into itself or its own descendants; the tree refuses that drop before any request is sent.
- A move is refused while the file, or a file inside the moved folder, has an unsaved draft open in the editor.
