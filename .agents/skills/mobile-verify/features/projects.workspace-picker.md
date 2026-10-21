---
screen: /workspaces
selectors:
  - "Worktrees"
  - "Worktrees by review status"
  - "Search reviews and worktrees"
  - "Filter worktrees"
  - "Closed reviews"
  - "No matching worktrees"
  - "Clear search"
  - "Current"
  - "Read projects again"
tests:
  - packages/client/src/features/reviews/rules/review-list.spec.ts
  - packages/client/src/features/projects/rules/workspace-choices.spec.ts
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - packages/client/src/features/projects/queries/inventory-state.spec.ts
api:
  - POST /api/inventory/refresh
  - GET /api/inventory
  - POST /api/live/tickets
  - GET /api/live
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
---

# projects.workspace-picker

The workspace header button in Review, Files and History pushes Worktrees with a normal native back button. One list spans every paired environment and project, grouped by Needs you, Waiting on agent, Ready to merge and No review. The shared client owns current decision counts, status words, title fallback, search and checkbox filtering. Closed reviews appear only after Closed in the header.

## Drive it

1. Start a disposable Android run with populated reviews and worktrees. From Review, tap its workspace header button. Expect Worktrees, a native back button, Filter worktrees and Closed; no Choose workspace modal or Close action.
2. Check each status group and reviewed/total count. Long titles occupy at most two lines. Each row shows project and environment, and either PR number or branch. No review includes main and unreviewed checkouts, with unavailable worktrees disabled.
3. Search by title, branch, project, environment and folder. No results offers a clear empty state. Clear search restores the list without changing workspace.
4. In Filter worktrees, toggle project and environment checkbox items. Filters intersect; clearing the final checkbox shows no rows. Clear filters restores everything.
5. Open Closed and read a retained review. Return to Worktrees, then native Back returns to the originating screen. Selecting an active worktree changes workspace and returns, preserving the existing document-leave guard.
6. Repeat opening, searching, selecting and Back from Files and History. On tablet, the embedded navigator uses the same status list with component controls. Keep tablet proof distinct from Android phone proof.

Retain screenshots and an Android screen recording; independently compare the marks and review records with the disposable server. Run the changed shared rules and query specs by name.
