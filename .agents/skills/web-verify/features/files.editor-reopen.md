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

Closing a file's tab while editing saves the draft, and opening the file again starts a fresh editor on the saved text. While one pane edits a file, the same file opened in the other pane cannot start a second editor.

## Sub-features

- `files.editor-reopen` — Editor reopening and restored state.

## How to get to it (user POV)

- Review → Files → right-click a changed file → Open file → Edit → close the tab (`Close <name>` on the tab, the tab's context menu Close, or `Alt+W`) → open the file again the same way.
- Right-click a document tab → "Open to the side" (or `Alt+\`) opens the same file in the second pane; its Edit button is disabled with the title "Editing in another pane".

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

 the sample `README.md` is modified, so the tree menu offers "Open file".

### 1. Closing the editor saves its draft; reopening starts a fresh editor

1. Navigate to `/`, then click button `Review`, then click tab `Files`
   Expect: treeitem "README.md".
2. Right-click treeitem `README.md`, then click menuitem `Open file`
   Expect: tab "README.md Close README.md" selected; button "Edit".
3. Click button `Edit`, then replace the contents of textbox named `README.md` with 'Closed editor marker'
   Expect: status "Unsaved changes" (replacing the field contents replaces the editor's whole text).
4. Click button `Close README.md`
   Expect: tab "README.md Close README.md" gone; tab "Changes Close Changes" selected. Disk: `cat "$REPO/README.md"` prints `Closed editor marker`.
5. Without a full page load (a page load would drop the in-memory draft this step checks): Click button `Review`, click tab `Files`, Right-click treeitem `README.md`, click menuitem `Open file`, then click button `Edit`
   Expect: before the click, the Reader's paragraph "Closed editor marker" and the button "Edit" (not "Resume edit"); after it, textbox "README.md" and status "Saves as you pause" (a fresh session whose starting text is the saved draft; the aria snapshot does not print the editor's text).
6. Fill textbox `README.md` with 'Reopened editor marker', then click button `Done`
   Expect: button "Edit" back. Disk: `cat "$REPO/README.md"` prints `Reopened editor marker`.

### 2. An editor keeps its draft ownership while the file opens in the other pane

Use fresh baseline state for each scenario.

1. Navigate to `/`, click button `Review`, click tab `Files`, Right-click treeitem `README.md`, click menuitem `Open file`
   Expect: tab "README.md Close README.md" selected; button "Edit".
2. Right-click tab `/README.md/`, then click menuitem `/Open to the side/`
   Expect: region "Left pane" and region "Right pane", each with a tab "README.md Close README.md" and an enabled button "Edit" (two matches).
3. Click button `Edit` within region named `Left pane`
   Expect: region "Left pane" shows button "Done" and textbox "README.md"; the page now holds exactly one button "Edit", [disabled], in region "Right pane" (title "Editing in another pane").

### Observable proof

Read disk after both saves/reopen; verify Saves as you pause on retained text. In split mode only the other pane’s Edit is disabled.

Automated coverage: `files-editor-reopen.test.tsx`.

## Gotchas

- With the file open in both panes there are two "Edit" buttons; scope the click to one pane with region "Left pane" (or "Right pane"). Starting Edit before "Open to the side" does not work: going from one pane to two remounts the left pane, which ends its edit session (the draft is saved) and leaves both "Edit" buttons enabled.
- Once split, every address that exists in both panes ("Close README.md", tab "/README.md/", "Edit") needs the same pane scope. Reset with `$C stop` and `$C start` (then pair again); the saved tab layout survives a full reload of `/`.
- The menu item name carries its shortcut text, so match it with `/Open to the side/`.
- Saves rewrite the sample `README.md`; restore it with `printf '# Sample repository\n\nA change to review.\n' > "$REPO/README.md"`.
