---
route: /$projectId/$worktreeId
selectors:
  - 'Review'
  - 'Changes'
  - 'Mark as reviewed'
  - 'Unmark as reviewed'
  - 'Show timeline'
  - 'Timeline of '
  - ' as unreviewed'
tests:
  - apps/web/spec/integration/reviews-changed-file-menu.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/file-commits
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.changed-file-menu

The Changes panel's file menu marks the file reviewed, opens its diff or file, shows its timeline, copies its relative path, or discards its changes.

Open a worktree's Changes panel and right-click a changed file. Mark as reviewed updates its row and persisted fingerprint; reopen the menu to unmark. Show timeline opens that file's history and closes the phone sheet. Copy relative path and Open file use the selected row's path.

There is no Comment action in the menu or the document bar. Pressing C opens no composer. Reviewed remains in the document's top bar with R, and mark-all still works on the Changes list. Capture the panel and diff bar at desktop and phone widths. Independently read reviewed marks before and after marking, reloading and unmarking.
