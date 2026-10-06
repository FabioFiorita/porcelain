# files.edit

## What it is

Editing a file in the browser writes it to disk: after a 3 second pause in typing, on `Mod+S`, on Done, and when its tab closes while still editing.

## How a user reaches it

- Review (phone) or the review sidebar (desktop) → Files tab → right-click a changed file → Open file → Edit (pencil button in the file toolbar; its label is "Resume edit" when an unsaved draft is kept).
- For an unchanged file the tree menu item is "Open" instead of "Open file"; a single click on a changed (non-image, non-HTML) file opens its diff, not the file.
- In the editor: `Mod+S` saves now; Done saves and leaves the editor; closing the tab (`Close <name>` on the tab, or `Alt+W`) saves; moving focus out of the editor saves.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. `$REPO` is the path `start` prints after `repository`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

None: the sample repository's `README.md` is already modified, so the tree menu offers "Open file".

1. Open `/` on the instance web URL
   Look for: Page Title "Changes — repository".
2. Click the button named 'Review'
   Look for: dialog "Worktree review" with tabs "Changes", "Files", "History".
3. Click the tab named 'Files'
   Look for: treeitem "README.md" under region "All files".
4. Right-click the tree item named 'README.md'
   Look for: a menu with menuitems "Open diff", "Open file", "Show timeline".
5. Click the menu item named 'Open file'
   Look for: the sheet closes; tab "README.md Close README.md" is selected; heading "Sample repository" (Markdown opens in Reader); button "Edit".
6. Click the button named 'Edit'
   Look for: textbox "README.md" (the editor; it may first show status "Loading editor…"), status "Saves as you pause", paragraph "Saving edits the changes you are reviewing.", button "Done".
7. Focus the 'README.md' editor, select all with `Mod+A`, type 'Browser autosave marker', and read back the editor content to confirm it matches, then wait for the text 'Saved'
   Look for: status "Unsaved changes", then about 3 seconds later status "Saved".
   Disk: `cat "$REPO/README.md"` prints `Browser autosave marker` (selecting all and typing replaces the editor’s whole text).
8. Focus the 'README.md' editor, select all with `Mod+A`, type 'Browser shortcut marker', and read back the editor content to confirm it matches, then press `Mod+S`
   Look for: status "Saved" right away (no 3 second wait). Disk: `cat "$REPO/README.md"` prints `Browser shortcut marker`.
9. Focus the 'README.md' editor, select all with `Mod+A`, type 'Browser done marker', and read back the editor content to confirm it matches, then click the button named 'Done'
   Look for: textbox "README.md" is gone; button "Edit" is back; the Reader shows paragraph "Browser done marker". Disk: `cat "$REPO/README.md"` prints `Browser done marker`.
10. Click the button named 'Edit', then focus the 'README.md' editor, select all with `Mod+A`, type 'Browser close marker', and read back the editor content to confirm it matches
    Look for: status "Unsaved changes".
11. Click the button named 'Close README.md'
    Look for: tab "README.md Close README.md" is gone; tab "Changes Close Changes" is selected. Disk: `cat "$REPO/README.md"` prints `Browser close marker`.
12. Inspect browser network evidence
    Look for: four `POST /api/worktrees/<id>/files` answered 200, one per save (steps 7, 8, 9, 11), and `GET /api/worktrees/<id>/text?path=README.md` answered 200 when the file opened.

## What proves it works

- The disk checks after steps 7, 8, 9 and 11: each marker is in `$REPO/README.md`, so the server wrote every save path (pause, shortcut, Done, tab close).
- Browser network evidence shows a 200 `POST .../files` per save; open `/` on the instance web URL and reopening the file shows the last marker, so the server kept it.
- `apps/web/spec/integration/files-edit.test.tsx`: after a fill the status reads "Saved" and `server.text()` holds the autosave marker; Done returns to the "Edit" button and the server holds the Done marker; closing the tab while editing saves the close marker.

## Gotchas

- The autosave waits `FILE_AUTOSAVE_WAIT_MS` = 3000 ms after the last change (`apps/web/src/config/limits.ts`); each new edit restarts it. Keep focus in the editor and press `Mod+S`, or choose Done, for an immediate save.
- Select all before typing each replacement and read the editor content back. A "Saved" status alone does not establish that the intended content was entered.
- At a narrow browser viewport, the review sidebar lives in a sheet behind the "Review" button, and the sheet closes when a document opens. Click "Review" again to get back to the tree.
- The tab strip is saved per worktree in localStorage and survives loading `/`; tabs left by an earlier feature in the same instance (a second "README.md" tab or a split) make "Close README.md" or "Edit" ambiguous. `$C stop` and `$C start` for a clean instance.
- The edits change `README.md` in the sample repository for every later feature in this instance; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
