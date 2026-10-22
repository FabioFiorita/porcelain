---
route: /
selectors:
  - "Review"
  - "Worktree review"
  - "Files"
  - "Rename"
  - "Invalid name"
  - "Change no longer present"
tests:
  - apps/web/spec/integration/files-rename.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - POST /api/worktrees/:worktreeId/files
---

# files.rename

Renaming a tree entry moves it on disk and shows the new name without opening it. Renaming onto a name already in that folder is refused before any request is sent, and both files keep their content.

## Sub-features

- `files.rename` — Rename entries and preserve navigation.

## How to get to it (user POV)

- Review (phone width) → tab Files → right-click a row → menuitem "Rename" (it is the first item for a file, so `ArrowDown` then `Enter` reaches it too).
- Review → tab Files → right-click a row under "Pinned" → menuitem "Rename".
- `F2` on the focused tree row (the tree's own shortcut).

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

Before a full page load:

```sh
printf 'Notes to rename\n' > "$REPO/draft-notes.md"
```

### 1. Rename moves the file on disk

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Review`
   Expect: dialog "Worktree review".
3. Click tab `Files`
   Expect: treeitem "draft-notes.md" in the tree of region "All files".
4. Right-click treeitem `draft-notes.md`
   Expect: a menu whose first menuitem is "Rename".
5. Click menuitem `Rename`
   Expect: textbox "Rename draft-notes.md" in the row, holding `draft-notes.md`.
6. Fill textbox `/^Rename /` with 'final-notes.md'
   Expect: the textbox holds `final-notes.md`.
7. Press `Enter`
   Expect: treeitem "final-notes.md" shows, treeitem "draft-notes.md" is gone, the sheet "Worktree review" stays open, and no text "Change no longer present" appears.
   Disk: `ls "$REPO"` lists `final-notes.md` and not `draft-notes.md`; `cat "$REPO/final-notes.md"` prints `Notes to rename`.

### 2. Rename onto an existing name is refused

Continue in the open sheet; `final-notes.md` exists from part 1.

8. Right-click treeitem `final-notes.md`
   Expect: the menu opens.
9. Press `ArrowDown`
   Expect: menuitem "Rename" has focus.
10. Press `Enter`
    Expect: textbox "Rename final-notes.md".
11. Fill textbox `/^Rename /` with 'README.md'
    Expect: the textbox holds `README.md`.
12. Press `Enter`
    Expect: a toast in region "Notifications" with "Invalid name" and `"README.md" already exists.`; treeitem "final-notes.md" still shows.
    Disk: `cat "$REPO/README.md"` prints `# Sample repository`, a blank line, `A change to review.`; `cat "$REPO/final-notes.md"` prints `Notes to rename`.
13. Inspect HTTP traffic
    Expect: one `POST /api/worktrees/<worktreeId>/files` with a 2xx status (the step 7 rename), and none after step 12.

### Observable proof

Read renamed file/content and unchanged collision targets. Reload Review → Files: new name remains, old name is absent.

Automated coverage: `files-rename.test.tsx`.

## Gotchas

A rename opens nothing, so the sheet stays open. Do not click "Review" again while it is open.
- The clash is refused by the tree before any request: only the toast "Invalid name" shows, never the server's alert. A name holding `/` is refused the same way (`Name cannot include "/".`), so rename never moves an entry to another folder.
- `F2` needs a focused tree row without opening it. Clicking a file row opens the file and closes the sheet, so drive rename through the menu.
- The textbox name follows the row (`Rename <name>`), so address it with `/^Rename /`.
