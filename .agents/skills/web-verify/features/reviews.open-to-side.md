---
route: /
selectors:
  - 'Review'
  - 'Worktree review'
  - 'Files'
  - 'Changes'
  - 'History'
  - 'Pinned files'
  - 'Pin file'
  - 'Open to the side'
  - 'Open in the right pane'
  - 'Open in the left pane'
  - 'Open graph'
  - 'Show timeline'
tests:
  - apps/web/spec/integration/reviews-open-to-side.test.tsx
  - apps/web/spec/integration/reviews-split-shortcuts.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/text
  - GET /api/worktrees/:worktreeId/commits
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
  - POST /api/worktrees/:worktreeId/changes/diffs
  - GET /api/projects/:projectId/file-preferences
  - PUT /api/projects/:projectId/file-preferences
---

# reviews.open-to-side

File tree, pinned files, changed-file rows (including Branch), and commit rows in History, Graph and file timelines offer the existing pane owner's side-opening action.

## How to get to it (user POV)

- Right-click an openable file or commit row, then choose "Open to the side". Once split, the menu label is "Open in the right pane" or "Open in the left pane", according to the source/focused pane.
- Alt-click the same row, including an already-selected tree file.
- Pin a file from Files → "Pin file" to reach the same action under "Pinned files".
- History → "Open graph", or a file menu → "Show timeline", reaches the additional commit rows.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Alt-click opens the row's ordinary document into the other pane. The source pane keeps its active document. A changed text file opens its diff; an unchanged file, image or HTML file opens its file document. Commit rows retain their commit identity and timeline file anchor.

1. Open Review → Files, right-click README.md, then choose "Open to the side".
   Expect: left pane retains Changes; right pane holds the README.md diff. After the menu and sheet disappear, the destination document tab has actual DOM focus.
2. Open Review again, right-click the row, and inspect "Open in the left pane". Escape, then Alt-click the row.
   Expect: the left pane now opens the diff and the right pane keeps it. The left document tab receives focus after closure.
3. Open the sheet with `Alt+Shift+R` so the toolbar trigger does not change pane focus. Inspect "Open in the right pane". Escape the menu and sheet.
4. Repeat the side menu and Alt-click through a pinned file, a Changes row, a Branch file row and a History commit row. For a clean file, commit it in the fixture repository before opening it. Open it normally, reopen Files, then Alt-click its already-selected tree row.
   Expect: one destination tab with the expected file/diff/branch/commit identity; no normal open replacing the source.
5. Open Graph and a file timeline. Repeat their commit row menu and Alt-click.
   Expect: the graph/timeline remains in the source pane; the destination shows the selected commit. A timeline opens the original file comparison.
6. Press `Alt+W` on the focused destination after the first split.
   Expect: closing its last tab folds the split and the source document remains. Inspect console and requests for unexpected failures.

Automated coverage: `reviews-open-to-side.test.tsx`, `reviews-split-shortcuts.test.tsx`.

## Gotchas

- Pane focus determines opening direction and keyboard ownership. Use the History commit’s actual OID, not its subject, for readbacks.
