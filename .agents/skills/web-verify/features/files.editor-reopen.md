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

`C=.agents/skills/web-verify/scripts/cli; $C start`. `$REPO` is the path `start` prints after `repository`.

### Setup

None: the sample `README.md` is modified, so the tree menu offers "Open file".

### 1. Closing the editor saves its draft; reopening starts a fresh editor

1. `$C open /`, then `$C click --role button --name "Review"`, then `$C click --role tab --name "Files"`
   Look for: treeitem "README.md".
2. `$C click --role treeitem --name "README.md" --button right`, then `$C click --role menuitem --name "Open file"`
   Look for: tab "README.md Close README.md" selected; button "Edit".
3. `$C click --role button --name "Edit"`, then `$C fill --role textbox --name "README.md" "Closed editor marker"`
   Look for: status "Unsaved changes" (`fill` replaces the editor's whole text).
4. `$C click --role button --name "Close README.md"`
   Look for: tab "README.md Close README.md" gone; tab "Changes Close Changes" selected. Disk: `cat "$REPO/README.md"` prints `Closed editor marker`.
5. Without `open` (a page load would drop the in-memory draft this step checks): `$C click --role button --name "Review"`, `$C click --role tab --name "Files"`, `$C click --role treeitem --name "README.md" --button right`, `$C click --role menuitem --name "Open file"`, then `$C click --role button --name "Edit"`
   Look for: before the click, the Reader's paragraph "Closed editor marker" and the button "Edit" (not "Resume edit"); after it, textbox "README.md" and status "Saves as you pause" (a fresh session whose starting text is the saved draft; the aria snapshot does not print the editor's text).
6. `$C fill --role textbox --name "README.md" "Reopened editor marker"`, then `$C click --role button --name "Done"`
   Look for: button "Edit" back. Disk: `cat "$REPO/README.md"` prints `Reopened editor marker`.

### 2. An editor keeps its draft ownership while the file opens in the other pane

Use a fresh instance (`$C stop; $C start`).

1. `$C open /`, `$C click --role button --name "Review"`, `$C click --role tab --name "Files"`, `$C click --role treeitem --name "README.md" --button right`, `$C click --role menuitem --name "Open file"`
   Look for: tab "README.md Close README.md" selected; button "Edit".
2. `$C click --role tab --name "/README.md/" --button right`, then `$C click --role menuitem --name "/Open to the side/"`
   Look for: region "Left pane" and region "Right pane", each with a tab "README.md Close README.md" and an enabled button "Edit" (two matches).
3. `$C click --within-role region --within-name "Left pane" --role button --name "Edit"`
   Look for: region "Left pane" shows button "Done" and textbox "README.md"; the page now holds exactly one button "Edit", [disabled], in region "Right pane" (title "Editing in another pane").

## What proves it works

- Scenario 1: the disk checks after steps 4 and 6, and step 5's "Saves as you pause" status on text that already holds "Closed editor marker".
- Scenario 2: the single disabled "Edit" in the right pane while the left pane's editor and "Done" stay.
- `apps/web/spec/integration/files-editor-reopen.test.tsx`: closing the tab saves the closed-editor marker (`server.text()`); the reopened editor contains it, shows "Saves as you pause" and saves the reopened marker on Done; with the file open in both panes, starting Edit in one leaves the other's "Edit" disabled and shows "Done".

## Gotchas

- With the file open in both panes there are two "Edit" buttons; scope the click to one pane with `--within-role region --within-name "Left pane"` (or `"Right pane"`). Starting Edit before "Open to the side" does not work: going from one pane to two remounts the left pane, which ends its edit session (the draft is saved) and leaves both "Edit" buttons enabled.
- Once split, every address that exists in both panes ("Close README.md", tab "/README.md/", "Edit") needs the same pane scope. Reset with `$C stop` and `$C start`; the tab layout persists in localStorage across `open /`.
- The menu item name carries its shortcut text, so match it with `/Open to the side/`.
- The CLI browser is 414 px wide: the tree lives in the sheet behind "Review", which closes when the file opens; click "Review" again before reopening.
- Saves rewrite the sample `README.md`; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
