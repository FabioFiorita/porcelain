---
screen: /workspaces
selectors:
  - 'Worktrees'
  - 'Worktrees by review status'
  - 'Search reviews and worktrees'
  - 'Filter worktrees'
  - 'Closed reviews'
  - 'No matching worktrees'
  - 'Clear search'
  - 'Current'
  - 'Read projects again'
tests:
  - packages/client/src/features/reviews/rules/review-list.spec.ts
  - packages/client/src/features/projects/rules/workspace-choices.spec.ts
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - packages/client/src/features/projects/queries/inventory-state.spec.ts
  - packages/git/src/actions/commands/archive-review.spec.ts
  - packages/client/src/features/reviews/queries/review-list.spec.ts
api:
  - POST /api/reviews/:reviewId/archive
  - POST /api/inventory/refresh
  - GET /api/inventory
  - POST /api/live/tickets
  - GET /api/live
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
---

# projects.workspace-picker

The workspace header button in Review, Files and History pushes Worktrees with a normal native back button. One list spans every paired environment and project, with a compact Projects section first, then Needs you, Waiting on agent, Ready to merge and No review. The shared client owns current decision counts, status words, title fallback, search and checkbox filtering. Archived reviews appear under Closed in the header. Merged or closed PR reviews appear only under Closed, with Archive inside the review row; manually closed reviews without a PR also appear under Closed.

## Drive it

1. Start a disposable Android run with populated reviews and worktrees. From Review, tap its workspace header button. Expect Worktrees, a native back button, Filter worktrees and Closed; no Choose workspace modal or Close action.
2. Check each status group and reviewed/total count. Long titles occupy at most two lines. Each row shows project and environment, and either PR number or branch. Projects contains one main checkout per project, showing the project name as primary text and branch · environment in one truncated muted line, and never duplicates it in a status group even with an active review. No review includes only non-main unreviewed checkouts. Unavailable checkouts are disabled.
3. Toggle each group header and its chevron, including Projects and No review. Collapse two independently, search and clear, leave and reopen Worktrees, then force-stop and relaunch Porcelain Dev: each choice survives. Reopen one and check the other stays collapsed. Capture expanded and collapsed screenshots.
4. Check the Search placeholder and search icon and consistent row title/badge indentation, then search by title, branch, project, environment and folder. Search also applies to Projects. No results offers a clear empty state. Clear search restores the list without changing workspace.
5. In Filter worktrees, Projects and Environments are inline sections in one native menu; no overlapping submenus. Toggle project and environment checkbox items. Filters intersect and also apply to Projects; clearing the final checkbox shows no rows. Clear filters restores everything.
6. Open Closed and read a retained review. Return to Worktrees, then native Back returns to the originating screen. Selecting an active worktree changes workspace and returns, preserving the existing document-leave guard.
7. Repeat opening, searching, selecting and Back from Files and History. On tablet, the embedded navigator uses the same status list with component controls. Keep tablet proof distinct from Android phone proof.

Retain screenshots and an Android screen recording; independently compare the marks and review records with the disposable server. Run the changed shared rules and query specs by name.

## Archive a completed review

With a review linked to a merged or closed PR, use Archive in its list row. In Settings, When archiving a review controls local worktree, local branch and remote branch deletion; all default on. The confirmation names the actual deletion targets. Keeping a worktree while deleting its branch detaches that checkout and says so in the confirmation. The main checkout and its branches stay protected.

Cancel and verify no deletion. With uncommitted files or unpushed commits, verify the explicit warning and confirm the data-loss risk separately. Ignored files never count as dirty. Confirm a branch with no upstream reports skipped remote deletion; an auto-deleted remote branch reports already deleted without an unpushed warning when its head matches the merged PR. A failed preview clears its checking text and shows a plain reason. Archive while that worktree is selected: selection leaves it before deletion. Verify the review stays under Closed with the Archived badge and remains readable. On Android, the data-loss acknowledgement switch starts off and Archive stays disabled until it is enabled. A retained worktree stays accessible under No review (or Projects for the main checkout). Capture before, confirmation, Closed, settings and a short journey recording.
