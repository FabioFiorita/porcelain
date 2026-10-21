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

The workspace header button in Review, Files and History pushes Worktrees with a normal native back button. One list spans every paired environment and project, with a compact Projects section first, then Needs you, Waiting on agent, Ready to merge and No review. The shared client owns current decision counts, status words, title fallback, search and checkbox filtering. Archived reviews appear through the icon-only Closed reviews header action. Update opens the native update sheet when offers exist; follow access.updates. Merged or closed PR reviews appear only under Closed, with Archive inside the review row; manually closed reviews without a PR also appear under Closed.

## Drive it

1. Start a disposable Android run with populated reviews and worktrees. From Review, tap its workspace header button. Expect Worktrees, a native back button, adjacent icon-only Filter worktrees and Closed reviews controls; no Choose workspace modal or Close action.
2. Check each status group and reviewed/total count. Titles occupy one truncated line, with a trailing muted reviewed/total count. Line 2 has one status icon, muted project text when more than one project survives search/filters, the truncated branch and a single-line computer Badge, with no separators. No review rows show project instead of repeating their branch title; Projects rows keep only branch beneath project. Reason badges, age text and the row chevron are absent; the native Item uses its xs size. Full reasons remain in its accessible label and the review detail. Published review details include the unexplained-file count and paths alongside the recommendation and proof. Project, environment and PR metadata remain searchable and accessible. Projects contains one main checkout per project, showing the project name as primary text and muted branch text next to a secondary computer badge, and never duplicates it in a status group even with an active review. No review includes only non-main unreviewed checkouts. Unavailable checkouts are disabled.
3. Toggle each group header and its chevron, including Projects and No review. Collapse two independently, search and clear, leave and reopen Worktrees, then force-stop and relaunch Porcelain Dev: each choice survives. Reopen one and check the other stays collapsed. Capture expanded and collapsed screenshots.
4. Check each main, review and unreviewed row has its computer in a native secondary Badge beside its branch, truncated to keep line 2 compact, including long branch and computer names. Check the Search placeholder and search icon and consistent row title/badge indentation, then search by title, branch, project, environment and folder. Search also applies to Projects. No results offers a clear empty state. Clear search restores the list without changing workspace.
5. In Filter worktrees, Projects and Computers are inline sections in one native menu; no overlapping submenus. Toggle project and environment checkbox items. Filters intersect and also apply to Projects; clearing the final checkbox shows no rows. Clear filters restores everything.
6. Open Closed and read a retained review. The collapsible Closed group is the only list heading, with no duplicate Closed reviews heading above Search. Return to Worktrees, then native Back returns to the originating screen. Selecting an active worktree changes workspace and returns, preserving the existing document-leave guard.
7. Repeat opening, searching, selecting and Back from Files and History. On tablet, the embedded navigator uses the same status list with component controls. Keep tablet proof distinct from Android phone proof.

Retain screenshots and an Android screen recording; independently compare the marks and review records with the disposable server. Run the changed shared rules and query specs by name.

## Archive a completed review

With a review linked to a merged or closed PR, use Archive in its list row. In Settings → Reviews & Git, When archiving a review controls local worktree, local branch and remote branch deletion; all default on. The confirmation names the actual deletion targets. Keeping a worktree while deleting its branch detaches that checkout and says so in the confirmation. The main checkout and its branches stay protected.

Cancel and verify no deletion. With uncommitted files or unpushed commits, verify the explicit warning and confirm the data-loss risk separately. Ignored files never count as dirty. Confirm a branch with no upstream reports skipped remote deletion; an auto-deleted remote branch reports already deleted without an unpushed warning when its head matches the merged PR. A failed preview clears its checking text and shows a plain reason. Archive while that worktree is selected: selection leaves it before deletion. Verify the review stays under Closed with Archived retained in its accessible label and review detail and remains readable. On Android, the data-loss acknowledgement switch starts off and Archive stays disabled until it is enabled. A retained worktree stays accessible under No review (or Projects for the main checkout). Capture before, confirmation, Closed, settings and a short journey recording.
