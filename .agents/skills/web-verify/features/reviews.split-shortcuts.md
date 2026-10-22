---
route: /
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Open to the side"
  - "Open documents"
  - "Open documents, "
  - " pane"
  - "Close tab"
  - "Open the tab to the side"
tests:
  - apps/web/spec/integration/reviews-split-shortcuts.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/text
---

# reviews.split-shortcuts

With the document area split into two panes, the tab shortcuts act on the focused pane only: `Alt+W` closes the focused pane's active tab, and closing the last tab of the right pane folds the split back into one pane.

## Sub-features

- `reviews.split-shortcuts` — Split views and keyboard controls.

## How to get to it (user POV)

- Split: right-click a tab → menuitem "Open to the side" (its name also carries the shortcut text), or `Alt+\` on the focused pane's active tab. Once split, the menu item reads "Open in the right pane" / "Open in the left pane".
- Tab shortcuts (shortcuts dialog `Mod+/`, group "Tabs"): `Alt+ArrowRight` next tab, `Alt+ArrowLeft` previous tab, `Alt+W` close tab, `Alt+\` open the tab to the side. They are ignored while focus is in a text field.
- The split works at phone width too: there is no breakpoint guard, the two panes share the 414px width.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Opening the split registers the tab shortcuts once; development builds reject duplicate registrations with an error, and production builds warn.

1. Navigate to `/`, then click button `Review`, then click tab `Files`
   Expect: in the dialog, treeitem "README.md".
2. Right-click treeitem `README.md`, then click menuitem `Open file`
   Expect: the sheet closes; tab "README.md Close README.md" selected in tablist "Open documents".
3. Right-click tab `/README.md/`, then click menuitem `/Open to the side/`
   Expect: regions "Left pane" and "Right pane"; tablists "Open documents, left pane" (tabs "Changes Close Changes", "README.md Close README.md") and "Open documents, right pane" (tab "README.md Close README.md"). URL carries `side=`.
4. Click button `Review`, then press `Escape`
   Expect: the sheet opens and closes; focus returns to the "Review" button, which only the right pane shows while split, so the right pane is now focused.
5. Press `Alt+w`
   Expect: regions "Left pane" and "Right pane" gone; one tablist "Open documents" with tabs "Changes Close Changes" and "README.md Close README.md" (the left pane's README.md tab survived).
6. Inspect console
   Expect: no hotkey conflict errors.

### Observable proof

- Step 5 closes only the right pane's tab (the split folds, the left pane keeps README.md) and step 6 shows no duplicate-registration errors.

Automated coverage: `reviews-split-shortcuts.test.tsx`.

## Gotchas

- Both panes can have identical README tabs. Scope Right pane or focus it via its Review button; Alt+W acts on the last focused pane.
- Alt+Backslash opens/focuses the other pane. Split layout persists; close right-pane tabs to reset.
