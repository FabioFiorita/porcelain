---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Edit"
  - "Done"
  - "Saved"
  - "Saves as you pause"
  - "Saving edits the changes you are reviewing."
tests:
  - apps/web/spec/integration/files-edit.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
  - POST /api/worktrees/:worktreeId/files
---

# files.edit

Editing a file in the browser writes it to disk: after a 3 second pause in typing, on `Mod+S`, on Done, and when its tab closes while still editing.

## How to get to it (user POV)

- Review (phone) or the review sidebar (desktop) → Files tab → right-click a changed file → Open file → Edit (pencil button in the file toolbar; its label is "Resume edit" when an unsaved draft is kept).
- For an unchanged file the tree menu item is "Open" instead of "Open file"; a single click on a changed (non-image, non-HTML) file opens its diff, not the file.
- In the editor: `Mod+S` saves now; Done saves and leaves the editor; closing the tab (`Close <name>` on the tab, or `Alt+W`) saves; moving focus out of the editor saves.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

 the sample repository's `README.md` is already modified, so the tree menu offers "Open file".

1. Navigate to `/`
   Expect: title "Changes — repository".
2. Click button `Review`
   Expect: dialog "Worktree review" with tabs "Files", "Changes", "History".
3. Click tab `Files`
   Expect: treeitem "README.md" under region "All files".
4. Right-click treeitem `README.md`
   Expect: a menu with menuitems "Open diff", "Open file", "Show timeline".
5. Click menuitem `Open file`
   Expect: the sheet closes; tab "README.md" is selected; heading "Sample repository" (Markdown opens in Reader); button "Edit".
6. Click button `Edit`
   Expect: textbox "README.md" (the editor; it may first show status "Loading editor…"), status "Saves as you pause", paragraph "Saving edits the changes you are reviewing.", button "Done".
7. Fill textbox `README.md` with 'Browser autosave marker', then wait for 'Saved'
   Expect: status "Unsaved changes", then about 3 seconds later status "Saved".
   Disk: `cat "$REPO/README.md"` prints `Browser autosave marker` (replacing the field contents replaces the editor's whole text).
8. Fill textbox `README.md` with 'Browser shortcut marker' then press `ControlOrMeta+s`
   Expect: status "Saved" right away (no 3 second wait). Disk: `cat "$REPO/README.md"` prints `Browser shortcut marker`.
9. Fill textbox `README.md` with 'Browser done marker' then click button `Done`
   Expect: textbox "README.md" is gone; button "Edit" is back; the Reader shows paragraph "Browser done marker". Disk: `cat "$REPO/README.md"` prints `Browser done marker`.
10. Click button `Edit` then replace the contents of textbox named `README.md` with 'Browser close marker'
    Expect: status "Unsaved changes".
11. Click button `Close README.md`
    Expect: tab "README.md" is gone; tab "Changes" is selected. Disk: `cat "$REPO/README.md"` prints `Browser close marker`.
12. Inspect HTTP traffic
    Expect: four `POST /api/worktrees/<id>/files` answered 200, one per save (steps 7, 8, 9, 11), and `GET /api/worktrees/<id>/text?path=README.md` answered 200 when the file opened.

### Observable proof

Check disk after pause, shortcut, Done and tab-close saves; each POST answers 200. Reload/reopen: last marker remains.

Automated coverage: `files-edit.test.tsx`.

## Gotchas

- Autosave waits three seconds after the last edit; each edit restarts it. Mod+S with editor focus or Done saves immediately.
- Per-worktree tabs survive reload and can duplicate names/splits: close leftovers or reset the instance before the recipe.
