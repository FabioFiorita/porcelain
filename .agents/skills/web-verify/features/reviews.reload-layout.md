# reviews.reload-layout

## What it is

The document tabs (which are open, which are pinned) and each diff's collapsed state are saved per worktree in the browser, so after a reload the same tabs come back, the pinned tab still shows its pin, and a collapsed diff stays collapsed.

## How a user reaches it

- Open files as tabs: Review → sidebar tab "Files" → right-click a changed file's treeitem → menuitem "Open file" (a plain click on a changed file opens its diff instead).
- Pin a tab: right-click the tab → menuitem "Pin"; the tab's close button becomes "Unpin <name>" and pinned tabs move to the front. Right-click → "Unpin" or the "Unpin <name>" button undoes it.
- Collapse a diff: the chevron button "Collapse <path>" in a diff header (shown when a document holds more than one file); it becomes "Expand <path>". "Collapse all" / "Expand all" in the toolbar folds every file.
- Reload: any full page load of the workspace.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (prints `repository <path>`; call it `$REPO`).
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

```sh
printf '# Notes\n' > "$REPO/notes.md"
```

1. Open `/` on the instance web URL, then click the button named 'Review', then click the tab named 'Files'
   Look for: in the dialog, treeitems "README.md" and "notes.md".
2. Right-click the tree item named 'README.md', then click the menu item named 'Open file'
   Look for: the sheet closes; tab "README.md Close README.md" selected.
3. Click the button named 'Review', then right-click the tree item named 'notes.md', then click the menu item named 'Open file'
   Look for: tab "notes.md Close notes.md" selected; tab "README.md Close README.md" still there.
4. Right-click the tab whose name contains 'README.md', then click the menu item named 'Pin'
   Look for: button "Unpin README.md" (the README.md tab now reads "README.md Unpin README.md" and sits first); no "Close README.md".
5. Click the button named 'Review', then click the tab named 'Changes', then click the button named 'All changes'
   Look for: the sheet closes; tab "Changes Close Changes" selected; heading "Changes", text "2 files", buttons "Collapse README.md" and "Collapse notes.md". Page URL carries `entry=handoff`.
6. Click the button named 'Collapse README.md'
   Look for: button "Expand README.md" (aria-expanded false).
7. reload <path and query of the Page URL step 6 printed> (the reload)
   Look for: button "Expand README.md", button "Unpin README.md", tab "notes.md Close notes.md", tab "Changes Close Changes" selected.

## What proves it works

- Step 7 shows the pin, the third tab and the collapsed README.md diff after a full page load.
- `apps/web/spec/e2e/reviews-reload-layout.e2e.ts`: opens README.md and notes.md from Files, pins README.md ("Unpin README.md" visible), collapses README.md in All changes ("Expand README.md"), reloads, and finds "Expand README.md", "Unpin README.md", the notes.md tab and its "Close notes.md" button attached.

## Gotchas

- Phone width: the Files tree is in the review sheet behind "Review"; every "Open file" or "All changes" closes the sheet, so click "Review" again before the next tree or sidebar action. The sidebar remembers the Files surface, so step 3 needs no second "Files" click.
- Reload with the exact path and query printed as Page URL. open `/` on the instance web URL also restores the tabs and pin, but without `entry=handoff` it activates the last tab (notes.md); click tab "Changes Close Changes" to see "Expand README.md".
- An inactive tab's "Close <name>" button is transparent until hover but still in the accessibility tree.
- The layout and folds live in this browser's localStorage and persist for the instance. To reset: right-click the README.md tab → "Unpin", close the file tabs, and click "Expand README.md"; `rm "$REPO/notes.md"`.
