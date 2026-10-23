---
route: /
selectors:
  - "Review"
  - "Files"
  - "Open file"
  - "Pin"
  - "Unpin "
  - "Changes"
  - "All changes"
  - "Collapse"
  - "Expand"
  - "Close "
tests:
  - apps/web/spec/e2e/reviews-reload-layout.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/text
  - POST /api/worktrees/:worktreeId/changes/diffs
---

# reviews.reload-layout

The document tabs (which are open, which are pinned) and each diff's collapsed state are saved per worktree in the browser, so after a reload the same tabs come back, the pinned tab still shows its pin, and a collapsed diff stays collapsed.

## How to get to it (user POV)

- Open files as tabs: Review → sidebar tab "Files" → right-click a changed file's treeitem → menuitem "Open file" (a plain click on a changed file opens its diff instead).
- Pin a tab: right-click the tab → menuitem "Pin"; the tab's close button becomes "Unpin <name>" and pinned tabs move to the front. Right-click → "Unpin" or the "Unpin <name>" button undoes it.
- Collapse a diff: the chevron button "Collapse <path>" in a diff header (shown when a document holds more than one file); it becomes "Expand <path>". "Collapse all" / "Expand all" in the toolbar folds every file.
- Reload: any full page load of the workspace.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

```sh
printf '# Notes\n' > "$REPO/notes.md"
```

1. Navigate to `/`, then click button `Review`, then click tab `Files`
   Expect: in the dialog, treeitems "README.md" and "notes.md".
2. Right-click treeitem `README.md`, then click menuitem `Open file`
   Expect: the sheet closes; tab "README.md" selected.
3. Click button `Review`, then right-click treeitem named `notes.md`, then click menuitem `Open file`
   Expect: tab "notes.md" selected; tab "README.md" still there.
4. Right-click tab `/README.md/`, then click menuitem `Pin`
   Expect: button "Unpin README.md" (the README.md tab now reads "README.md Unpin README.md" and sits first); no "Close README.md".
5. Click button `Review`, then click tab `Changes`, then click button `All changes`
   Expect: the sheet closes; tab "Changes" selected; heading "Changes", text "2 files", buttons "Collapse README.md" and "Collapse notes.md". URL carries `entry=handoff`.
6. Click button `Collapse README.md`
   Expect: button "Expand README.md" (aria-expanded false).
7. Navigate to `<path and query of the URL step 6 printed>` (the reload)
   Expect: button "Expand README.md", button "Unpin README.md", tab "notes.md", tab "Changes" selected.

### Observable proof

Reload exact path/query: pin, third tab and collapsed README diff remain.

Automated coverage: `reviews-reload-layout.e2e.ts`.

## Gotchas

- Reload exact path/query: without entry=handoff, bare `/` may activate notes.md. Inactive Close buttons remain accessible while transparent.
- Tabs/pins/folds persist locally. Reset via Unpin, close file tabs, Expand README.md and remove notes.md.
