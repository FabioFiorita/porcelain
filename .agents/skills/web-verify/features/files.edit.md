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

`$C start`; pair your browser using the card’s pairing-link command. `$REPO` is `fixtures.repositoryPath` in the card’s `connection.json`.

### Setup

None: the sample repository's `README.md` is already modified, so the tree menu offers "Open file".

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: Page Title "Changes — repository".
2. Click button named `Review`
   Look for: dialog "Worktree review" with tabs "Changes", "Files", "History".
3. Click tab named `Files`
   Look for: treeitem "README.md" under region "All files".
4. Right-click treeitem named `README.md`
   Look for: a menu with menuitems "Open diff", "Open file", "Show timeline".
5. Click menuitem named `Open file`
   Look for: the sheet closes; tab "README.md Close README.md" is selected; heading "Sample repository" (Markdown opens in Reader); button "Edit".
6. Click button named `Edit`
   Look for: textbox "README.md" (the editor; it may first show status "Loading editor…"), status "Saves as you pause", paragraph "Saving edits the changes you are reviewing.", button "Done".
7. Replace the contents of textbox named `README.md` with 'Browser autosave marker', then wait for text 'Saved' to be visible
   Look for: status "Unsaved changes", then about 3 seconds later status "Saved".
   Disk: `cat "$REPO/README.md"` prints `Browser autosave marker` (replacing the field contents replaces the editor's whole text).
8. Replace the contents of textbox named `README.md` with 'Browser shortcut marker' then press `ControlOrMeta+s`
   Look for: status "Saved" right away (no 3 second wait). Disk: `cat "$REPO/README.md"` prints `Browser shortcut marker`.
9. Replace the contents of textbox named `README.md` with 'Browser done marker' then click button named `Done`
   Look for: textbox "README.md" is gone; button "Edit" is back; the Reader shows paragraph "Browser done marker". Disk: `cat "$REPO/README.md"` prints `Browser done marker`.
10. Click button named `Edit` then replace the contents of textbox named `README.md` with 'Browser close marker'
    Look for: status "Unsaved changes".
11. Click button named `Close README.md`
    Look for: tab "README.md Close README.md" is gone; tab "Changes Close Changes" is selected. Disk: `cat "$REPO/README.md"` prints `Browser close marker`.
12. Inspect HTTP requests and responses
    Look for: four `POST /api/worktrees/<id>/files` answered 200, one per save (steps 7, 8, 9, 11), and `GET /api/worktrees/<id>/text?path=README.md` answered 200 when the file opened.

## What proves it works

- The disk checks after steps 7, 8, 9 and 11: each marker is in `$REPO/README.md`, so the server wrote every save path (pause, shortcut, Done, tab close).
- Inspect HTTP requests and responses shows a 200 `POST .../files` per save; Navigate to `/` on the card’s web URL (full page load) and reopening the file shows the last marker, so the server kept it.
- `apps/web/spec/integration/files-edit.test.tsx`: after a fill the status reads "Saved" and `server.text()` holds the autosave marker; Done returns to the "Edit" button and the server holds the Done marker; closing the tab while editing saves the close marker.

## Gotchas

- The autosave waits `FILE_AUTOSAVE_WAIT_MS` = 3000 ms after the last change (`apps/web/src/config/limits.ts`); each new edit restarts it. Use `ControlOrMeta+s` (focus must be in the editor, which replacing the field contents leaves it in) or Done for an immediate save.
- Replacing the editor contents selects its whole text and types over it, so each save holds exactly the filled text.
- The browser at the map viewport is 414 px wide: the review sidebar lives in a sheet behind the "Review" button, and the sheet closes when a document opens. Click "Review" again to get back to the tree.
- The tab strip is saved per worktree in localStorage and survives a full reload of `/`; tabs left by an earlier feature in the same instance (a second "README.md" tab or a split) make "Close README.md" or "Edit" ambiguous. `$C stop` and `$C start`; pair your browser using the card’s pairing-link command for a clean instance.
- The edits change `README.md` in the sample repository for every later feature in this instance; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
