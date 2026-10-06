# files.rename

## What it is

Renaming a tree entry moves it on disk and shows the new name without opening it. Renaming onto a name already in that folder is refused before any request is sent, and both files keep their content.

## How a user reaches it

- Review (phone width) → tab Files → right-click a row → menuitem "Rename" (it is the first item for a file, so `ArrowDown` then `Enter` reaches it too).
- Review → tab Files → right-click a row under "Pinned" → menuitem "Rename".
- `F2` on the focused tree row (the tree's own shortcut).

## Driving it

Start with `$C start`. Set `REPO` to the path it prints after `repository`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

Before a page load:

```sh
printf 'Notes to rename\n' > "$REPO/draft-notes.md"
```

### 1. Rename moves the file on disk

1. Open `/` on the instance web URL
   Look for: Page Title "Changes — repository".
2. Click the button named 'Review'
   Look for: dialog "Worktree review".
3. Click the tab named 'Files'
   Look for: treeitem "draft-notes.md" in the tree of region "All files".
4. Right-click the tree item named 'draft-notes.md'
   Look for: a menu whose first menuitem is "Rename".
5. Click the menu item named 'Rename'
   Look for: textbox "Rename draft-notes.md" in the row, holding `draft-notes.md`.
6. Set the text field whose name starts with 'Rename ' to 'final-notes.md'
   Look for: the textbox holds `final-notes.md`.
7. Press `Enter`
   Look for: treeitem "final-notes.md" shows, treeitem "draft-notes.md" is gone, the sheet "Worktree review" stays open, and no text "Change no longer present" appears.
   Disk: `ls "$REPO"` lists `final-notes.md` and not `draft-notes.md`; `cat "$REPO/final-notes.md"` prints `Notes to rename`.

### 2. Rename onto an existing name is refused

Continue in the open sheet; `final-notes.md` exists from part 1.

8. Right-click the tree item named 'final-notes.md'
   Look for: the menu opens.
9. Press `ArrowDown`
   Look for: menuitem "Rename" has focus.
10. Press `Enter`
    Look for: textbox "Rename final-notes.md".
11. Set the text field whose name starts with 'Rename ' to 'README.md'
    Look for: the textbox holds `README.md`.
12. Press `Enter`
    Look for: a toast in region "Notifications" with "Invalid name" and `"README.md" already exists.`; treeitem "final-notes.md" still shows.
    Disk: `cat "$REPO/README.md"` prints `# Sample repository`, a blank line, `A change to review.`; `cat "$REPO/final-notes.md"` prints `Notes to rename`.
13. Inspect browser network evidence
    Look for: one `POST /api/worktrees/<worktreeId>/files` with a 2xx status (the step 7 rename), and none after step 12.

## What proves it works

- On disk: the file has its new name with the same content. After the refusal, `README.md` and `final-notes.md` are unchanged.
- loading `/`, then Review → Files, shows treeitem "final-notes.md" and no "draft-notes.md".
- `apps/web/spec/integration/files-rename.test.tsx` covers both parts. The first test asserts the new row shows and the old one is gone, that "Change no longer present" never appears, and that the server's root lists the new name and not the old. The second asserts that `ArrowDown` focuses "Rename", that the toast "Invalid name" shows, that the row stays, and that the server still holds both files' original text.

## Gotchas

- At phone width the tree lives in the sheet behind button "Review". A rename opens nothing, so the sheet stays open. Do not click "Review" again while it is open.
- The clash is refused by the tree before any request: only the toast "Invalid name" shows, never the server's alert. A name holding `/` is refused the same way (`Name cannot include "/".`), so rename never moves an entry to another folder.
- `F2` needs a focused tree row without opening it. Clicking a file row opens the file and closes the sheet, so drive rename through the menu.
- The textbox name follows the row (`Rename <name>`), so choose the text field whose name starts with "Rename ".
