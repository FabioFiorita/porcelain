# files.editor-reopen

## What it is

Closing a file's tab while editing saves the draft, and opening the file again starts a fresh editor on the saved text. While one pane edits a file, the same file opened in the other pane cannot start a second editor.

## How a user reaches it

- Review → Files → right-click a changed file → Open file → Edit → close the tab (`Close <name>` on the tab, the tab's context menu Close, or `Alt+W`) → open the file again the same way.
- Right-click a document tab → "Open to the side" (or `Alt+\`) opens the same file in the second pane; its Edit button is disabled with the title "Editing in another pane".

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. `$REPO` is the path `start` prints after `repository`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

None: the sample `README.md` is modified, so the tree menu offers "Open file".

### 1. Closing the editor saves its draft; reopening starts a fresh editor

1. Open `/` on the instance web URL, then click the button named 'Review', then click the tab named 'Files'
   Look for: treeitem "README.md".
2. Right-click the tree item named 'README.md', then click the menu item named 'Open file'
   Look for: tab "README.md Close README.md" selected; button "Edit".
3. Click the button named 'Edit', then focus the 'README.md' editor, select all with `Mod+A`, type 'Closed editor marker', and read back the editor content to confirm it matches
   Look for: status "Unsaved changes" (selecting all and typing replaces the editor’s whole text).
4. Click the button named 'Close README.md'
   Look for: tab "README.md Close README.md" gone; tab "Changes Close Changes" selected. Disk: `cat "$REPO/README.md"` prints `Closed editor marker`.
5. Without a page load (a page load would drop the in-memory draft this step checks): click the button named 'Review', click the tab named 'Files', right-click the tree item named 'README.md', click the menu item named 'Open file', then click the button named 'Edit'
   Look for: before the click, the Reader's paragraph "Closed editor marker" and the button "Edit" (not "Resume edit"); after it, textbox "README.md" and status "Saves as you pause" (a fresh session whose starting text is the saved draft; read back the editor content and confirm it is "Closed editor marker").
6. Focus the 'README.md' editor, select all with `Mod+A`, type 'Reopened editor marker', and read back the editor content to confirm it matches, then click the button named 'Done'
   Look for: button "Edit" back. Disk: `cat "$REPO/README.md"` prints `Reopened editor marker`.

### 2. An editor keeps its draft ownership while the file opens in the other pane

Use a fresh instance (`$C stop`, then `$C start`) and follow "Open workspace" from its fresh attachment page with the in-app browser.

1. Open `/` on the instance web URL, click the button named 'Review', click the tab named 'Files', right-click the tree item named 'README.md', click the menu item named 'Open file'
   Look for: tab "README.md Close README.md" selected; button "Edit".
2. Right-click the tab whose name contains 'README.md', then click the menu item whose name contains 'Open to the side'
   Look for: region "Left pane" and region "Right pane", each with a tab "README.md Close README.md" and an enabled button "Edit" (two matches).
3. Click the button named 'Edit' in the region named 'Left pane'
   Look for: region "Left pane" shows button "Done" and textbox "README.md"; the page now holds exactly one button "Edit", [disabled], in region "Right pane" (title "Editing in another pane").

## What proves it works

- Scenario 1: the disk checks after steps 4 and 6, and step 5's "Saves as you pause" status on text that already holds "Closed editor marker".
- Scenario 2: the single disabled "Edit" in the right pane while the left pane's editor and "Done" stay.
- `apps/web/spec/integration/files-editor-reopen.test.tsx`: closing the tab saves the closed-editor marker (`server.text()`); the reopened editor contains it, shows "Saves as you pause" and saves the reopened marker on Done; with the file open in both panes, starting Edit in one leaves the other's "Edit" disabled and shows "Done".

## Gotchas

- With the file open in both panes there are two "Edit" buttons; choose the button inside "Left pane" (or "Right pane"). Starting Edit before "Open to the side" does not work: going from one pane to two remounts the left pane, which ends its edit session (the draft is saved) and leaves both "Edit" buttons enabled.
- Once split, every address that exists in both panes ("Close README.md", the README.md tab, "Edit") needs the same pane scope. Reset with `$C stop` and `$C start`; the tab layout persists in localStorage across loading `/`.
- The menu item name carries its shortcut text, so choose the item whose name contains "Open to the side".
- At a narrow browser viewport, the tree lives in the sheet behind "Review", which closes when the file opens; click "Review" again before reopening.
- Saves rewrite the sample `README.md`; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
