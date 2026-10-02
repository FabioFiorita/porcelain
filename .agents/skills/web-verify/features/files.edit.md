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

## What it is

Editing a file in the browser writes it to disk: after a 3 second pause in typing, on `Mod+S`, on Done, and when its tab closes while still editing.

## How a user reaches it

- Review (phone) or the review sidebar (desktop) → Files tab → right-click a changed file → Open file → Edit (pencil button in the file toolbar; its label is "Resume edit" when an unsaved draft is kept).
- For an unchanged file the tree menu item is "Open" instead of "Open file"; a single click on a changed (non-image, non-HTML) file opens its diff, not the file.
- In the editor: `Mod+S` saves now; Done saves and leaves the editor; closing the tab (`Close <name>` on the tab, or `Alt+W`) saves; moving focus out of the editor saves.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. `$REPO` is the path `start` prints after `repository`.

### Setup

None: the sample repository's `README.md` is already modified, so the tree menu offers "Open file".

1. `$C open /`
   Look for: Page Title "Changes — repository".
2. `$C click --role button --name "Review"`
   Look for: dialog "Worktree review" with tabs "Changes", "Files", "History".
3. `$C click --role tab --name "Files"`
   Look for: treeitem "README.md" under region "All files".
4. `$C click --role treeitem --name "README.md" --button right`
   Look for: a menu with menuitems "Open diff", "Open file", "Show timeline".
5. `$C click --role menuitem --name "Open file"`
   Look for: the sheet closes; tab "README.md Close README.md" is selected; heading "Sample repository" (Markdown opens in Reader); button "Edit".
6. `$C click --role button --name "Edit"`
   Look for: textbox "README.md" (the editor; it may first show status "Loading editor…"), status "Saves as you pause", paragraph "Saving edits the changes you are reviewing.", button "Done".
7. `$C fill --role textbox --name "README.md" "Browser autosave marker"`
   Look for: status "Unsaved changes", then after 3 seconds status "Saved". Run `$C snapshot` again if it still reads "Unsaved changes" or "Saving…".
   Disk: `grep -c "Browser autosave marker" "$REPO/README.md"` prints `1`.
8. `$C fill --role textbox --name "README.md" "Browser shortcut marker"` then `$C press ControlOrMeta+s`
   Look for: status "Saved" right away (no 3 second wait). Disk: `grep -c "Browser shortcut marker" "$REPO/README.md"` prints `1`.
9. `$C fill --role textbox --name "README.md" "Browser done marker"` then `$C click --role button --name "Done"`
   Look for: textbox "README.md" is gone; button "Edit" is back; the Reader's first paragraph holds "Browser done marker" (after the earlier markers, see Gotchas). Disk: `grep -c "Browser done marker" "$REPO/README.md"` prints `1`.
10. `$C click --role button --name "Edit"` then `$C fill --role textbox --name "README.md" "Browser close marker"`
    Look for: status "Unsaved changes".
11. `$C click --role button --name "Close README.md"`
    Look for: tab "README.md Close README.md" is gone; tab "Changes Close Changes" is selected. Disk: `grep -c "Browser close marker" "$REPO/README.md"` prints `1`.
12. `$C network`
    Look for: four `POST /api/worktrees/<id>/files` answered 200, one per save (steps 7, 8, 9, 11), and `GET /api/worktrees/<id>/text?path=README.md` answered 200 when the file opened.

## What proves it works

- The disk checks after steps 7, 8, 9 and 11: each marker is in `$REPO/README.md`, so the server wrote every save path (pause, shortcut, Done, tab close).
- `$C network` shows a 200 `POST .../files` per save; `$C open /` and reopening the file shows the last marker, so the server kept it.
- `apps/web/spec/integration/files-edit.test.tsx`: after a fill the status reads "Saved" and `server.text()` holds the autosave marker; Done returns to the "Edit" button and the server holds the Done marker; closing the tab while editing saves the close marker.

## Gotchas

- The autosave waits `FILE_AUTOSAVE_WAIT_MS` = 3000 ms after the last change (`apps/web/src/config/limits.ts`); each new fill restarts it. Use `press ControlOrMeta+s` (focus must be in the editor, which `fill` leaves it in) or Done for an immediate save.
- `fill` on the editor does not replace the file: the CLI's fill inserts its text at the caret, which sits at the start of the file, so the markers pile up in front of `# Sample repository` (after step 11 the first line reads `Browser close markerBrowser autosave markerBrowser shortcut markerBrowser done marker# Sample repository`). Check the disk with `grep -c`, never an exact `cat`.
- The CLI browser is 414 px wide: the review sidebar lives in a sheet behind the "Review" button, and the sheet closes when a document opens. Click "Review" again to get back to the tree.
- The tab strip is saved per worktree in localStorage and survives `open /`; tabs left by an earlier feature in the same instance (a second "README.md" tab or a split) make "Close README.md" or "Edit" ambiguous. `$C stop` and `$C start` for a clean instance.
- The edits change `README.md` in the sample repository for every later feature in this instance; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
