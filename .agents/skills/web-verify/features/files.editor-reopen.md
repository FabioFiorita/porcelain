---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Edit"
  - "Done"
  - "Saves as you pause"
  - "Open to the side"
tests:
  - apps/web/spec/integration/files-editor-reopen.test.tsx
api:
  - GET /api/worktrees/:worktreeId/text
  - POST /api/worktrees/:worktreeId/files
---

# files.editor-reopen

## What it is

Closing a file's tab while editing saves the draft, and opening the file again starts a fresh editor on the saved text. While one pane edits a file, the same file opened in the other pane cannot start a second editor.

## How a user reaches it

- Review → Files → right-click a changed file → Open file → Edit → close the tab (`Close <name>` on the tab, the tab's context menu Close, or `Alt+W`) → open the file again the same way.
- Right-click a document tab → "Open to the side" (or `Alt+\`) opens the same file in the second pane; its Edit button is disabled with the title "Editing in another pane".

## Driving it

`$C start`; pair your browser using the card’s pairing-link command. `$REPO` is `fixtures.repositoryPath` in the card’s `connection.json`.

### Setup

None: the sample `README.md` is modified, so the tree menu offers "Open file".

### 1. Closing the editor saves its draft; reopening starts a fresh editor

1. Navigate to `/` on the card’s web URL (full page load), then click button named `Review`, then click tab named `Files`
   Look for: treeitem "README.md".
2. Right-click treeitem named `README.md`, then click menuitem named `Open file`
   Look for: tab "README.md Close README.md" selected; button "Edit".
3. Click button named `Edit`, then replace the contents of textbox named `README.md` with 'Closed editor marker'
   Look for: status "Unsaved changes" (replacing the field contents replaces the editor's whole text).
4. Click button named `Close README.md`
   Look for: tab "README.md Close README.md" gone; tab "Changes Close Changes" selected. Disk: `cat "$REPO/README.md"` prints `Closed editor marker`.
5. Without a full page load (a page load would drop the in-memory draft this step checks): Click button named `Review`, click tab named `Files`, Right-click treeitem named `README.md`, click menuitem named `Open file`, then click button named `Edit`
   Look for: before the click, the Reader's paragraph "Closed editor marker" and the button "Edit" (not "Resume edit"); after it, textbox "README.md" and status "Saves as you pause" (a fresh session whose starting text is the saved draft; the aria snapshot does not print the editor's text).
6. Replace the contents of textbox named `README.md` with 'Reopened editor marker', then click button named `Done`
   Look for: button "Edit" back. Disk: `cat "$REPO/README.md"` prints `Reopened editor marker`.

### 2. An editor keeps its draft ownership while the file opens in the other pane

Use a fresh instance (`$C stop`; then `$C start`; pair your browser using the card’s pairing-link command).

1. Navigate to `/` on the card’s web URL (full page load), click button named `Review`, click tab named `Files`, Right-click treeitem named `README.md`, click menuitem named `Open file`
   Look for: tab "README.md Close README.md" selected; button "Edit".
2. Right-click tab named `/README.md/`, then click menuitem named `/Open to the side/`
   Look for: region "Left pane" and region "Right pane", each with a tab "README.md Close README.md" and an enabled button "Edit" (two matches).
3. Click button named `Edit` within region named `Left pane`
   Look for: region "Left pane" shows button "Done" and textbox "README.md"; the page now holds exactly one button "Edit", [disabled], in region "Right pane" (title "Editing in another pane").

## What proves it works

- Scenario 1: the disk checks after steps 4 and 6, and step 5's "Saves as you pause" status on text that already holds "Closed editor marker".
- Scenario 2: the single disabled "Edit" in the right pane while the left pane's editor and "Done" stay.
- `apps/web/spec/integration/files-editor-reopen.test.tsx`: closing the tab saves the closed-editor marker (`server.text()`); the reopened editor contains it, shows "Saves as you pause" and saves the reopened marker on Done; with the file open in both panes, starting Edit in one leaves the other's "Edit" disabled and shows "Done".

## Gotchas

- With the file open in both panes there are two "Edit" buttons; scope the click to one pane with region "Left pane" (or "Right pane"). Starting Edit before "Open to the side" does not work: going from one pane to two remounts the left pane, which ends its edit session (the draft is saved) and leaves both "Edit" buttons enabled.
- Once split, every address that exists in both panes ("Close README.md", tab "/README.md/", "Edit") needs the same pane scope. Reset with `$C stop` and `$C start`; pair your browser using the card’s pairing-link command; the tab layout persists in localStorage across a full reload of `/`.
- The menu item name carries its shortcut text, so match it with `/Open to the side/`.
- The browser at the map viewport is 414 px wide: the tree lives in the sheet behind "Review", which closes when the file opens; click "Review" again before reopening.
- Saves rewrite the sample `README.md`; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
