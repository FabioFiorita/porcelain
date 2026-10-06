# reviews.split-shortcuts

## What it is

With the document area split into two panes, the tab shortcuts act on the focused pane only: `Alt+W` closes the focused pane's active tab, and closing the last tab of the right pane folds the split back into one pane. Opening the split registers the tab shortcuts once (no "already registered" warning).

## How a user reaches it

- Split: right-click a tab → menuitem "Open to the side" (its name also carries the shortcut text), or `Alt+\` on the focused pane's active tab. Once split, the menu item reads "Open in the right pane" / "Open in the left pane".
- Tab shortcuts (shortcuts dialog `Mod+/`, group "Tabs"): `Alt+ArrowRight` next tab, `Alt+ArrowLeft` previous tab, `Alt+W` close tab, `Alt+\` open the tab to the side. They are ignored while focus is in a text field.
- The split works at phone width too: there is no breakpoint guard, the two panes share the 414px width.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. No setup: README.md is in the sample repository.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

1. Open `/` on the instance web URL, then click the button named 'Review', then click the tab named 'Files'
   Look for: in the dialog, treeitem "README.md".
2. Right-click the tree item named 'README.md', then click the menu item named 'Open file'
   Look for: the sheet closes; tab "README.md Close README.md" selected in tablist "Open documents".
3. Right-click the tab whose name contains 'README.md', then click the menu item whose name contains 'Open to the side'
   Look for: regions "Left pane" and "Right pane"; tablists "Open documents, left pane" (tabs "Changes Close Changes", "README.md Close README.md") and "Open documents, right pane" (tab "README.md Close README.md"). Page URL carries `side=`.
4. Click the button named 'Review', then press `Escape`
   Look for: the sheet opens and closes; focus returns to the "Review" button, which only the right pane shows while split, so the right pane is now focused.
5. Press `Alt+W`
   Look for: regions "Left pane" and "Right pane" gone; one tablist "Open documents" with tabs "Changes Close Changes" and "README.md Close README.md" (the left pane's README.md tab survived).
6. Browser console evidence
   Look for: no warning containing "already registered".

## What proves it works

- Step 5 closes only the right pane's tab (the split folds, the left pane keeps README.md) and step 6 shows no duplicate-registration warning.
- `apps/web/spec/integration/reviews-split-shortcuts.test.tsx`: opens README.md, opens it to the side, sees the tab in region "Left pane", clicks the tab in region "Right pane", presses `Alt+W`, and expects "Right pane" gone, the README.md tab still visible, and no console warning containing "already registered".

## Gotchas

- While split, both panes hold a tab named "README.md Close README.md". Target the tab inside "Right pane", or focus that pane through its own "Review" button (step 4). Without a deliberate focus, `Alt+W` acts on whichever pane last received pointer or focus, and closing the left pane's README.md leaves the split in place.
- `Alt+\` from a pane opens the tab in the other pane and focuses it, so pressing `Alt+Backslash` right after step 2 is an alternative to the menu in step 3.
- The tab layout is saved in localStorage; a split survives a page load. Reset by closing the right pane's tab (step 4 then 5) or closing the extra tabs.
