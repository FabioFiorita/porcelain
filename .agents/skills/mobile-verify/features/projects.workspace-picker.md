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
  - 'current'
  - 'Read projects again'
tests:
  - packages/client/src/features/reviews/rules/review-list.spec.ts
  - packages/client/src/features/projects/rules/workspace-choices.spec.ts
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - packages/client/src/features/projects/queries/inventory-state.spec.ts
  - packages/git/src/actions/commands/archive-review.spec.ts
  - packages/client/src/features/reviews/rules/archive-review.spec.ts
  - packages/client/src/features/reviews/queries/review-list.spec.ts
  - apps/mobile/src/features/projects/rules/worktree-row.spec.ts
api:
  - POST /api/reviews/:reviewId/archive
  - POST /api/inventory/refresh
  - GET /api/inventory
  - POST /api/live/tickets
  - GET /api/live
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
---

# projects.workspace-picker

Worktrees lists projects and reviews across paired computers, with search, status filters, retained closed reviews and guarded archive.

## How to get to it (user POV)

- Workspace header in Review, Files or History → Worktrees; iPad sidebar selects worktrees.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

Preconditions: seed active checkouts, reviews in every status and one closed review on the disposable server.

1. From Review tap workspace header: Worktrees with native Back, icon-only Filter worktrees/Closed reviews, no Choose workspace modal/Close. Repeat from Files/History. iPad uses its embedded navigator.
2. Projects is first (one main checkout/project, never duplicated in status groups), then Needs you, Waiting on agent, Ready to merge, No review (non-main unreviewed checkouts only). Verify counts against server marks/reviews. Unavailable checkouts are disabled.
3. Rows have one non-interactive status icon, a one-line truncated title and trailing muted reviewed/total count. The second line has project only when multiple projects survive filters and branch without separators; No review has its branch as the title and project below, without repeating the branch. Projects keeps the branch below its project title. Rows never name a computer. Full titles, status groups, reasons and progress remain in the row accessibilityLabel and existing review details; computer names remain searchable and available in filters. No information-circle icon, reason badge or row chevron. Check every status group, a long title, the TalkBack announcement, Search/icon and indentation in light and dark.
4. Collapse two groups independently, search/clear, leave/reopen, force-stop/relaunch: choices persist. Reopen one without changing the other. Search title, branch, project, computer, PR and folder: Projects also filters, no matches is explicit, clearing preserves selection.
5. Filter worktrees has inline Projects/Computers checkbox sections. Filters intersect; deselecting the last shows no rows; Clear filters restores all. Closed shows only one Closed heading above the list, retained reviews remain readable; native Back returns to origin. Selecting an active checkout returns with workspace changed and draft guard intact.
6. Retain expanded/collapsed/filter/Closed screenshots and Android recording; independently read records.

### Archive a completed review

Precondition: review linked to merged/closed PR. In Settings → Reviews & Git, When archiving a review has worktree/local branch/remote branch switches, all default on.

1. Row Archive shows actual deletion targets. When deleting a worktree, it says the entire folder will be permanently deleted, including ignored files such as .env and local build output, even when ignored files are the only local contents. Cancel and independently verify .env remains. Keeping a worktree while deleting its branch explicitly detaches it without a folder-deletion warning; main checkout/branches stay protected. Settings configures deletion options; there is no separate archive shortcut, context-menu action or mobile completion-card Archive.
2. Dirty files/unpushed commits require their warning/acknowledgement; Android switch starts off and Archive stays disabled until checked. Ignored files alone are not dirty. No upstream skips remote deletion; auto-deleted remote at the merged PR head says already deleted without an unpushed warning. Failed preview replaces checking text with a plain reason.
3. Confirm for the selected worktree: selection leaves before deletion. Closed retains readable review and Archived in accessible label/detail. A kept worktree remains under No review (Projects for main). Capture before, confirmation, Closed and settings.
4. With long worktree and branch paths and Android font scale 2.0, scroll the confirmation body through the deletion targets, acknowledgement and any failure. Cancel and Archive review stay visible in a fixed footer; both labels fit without reducing font scaling. Reopen after a locked-worktree failure, acknowledge again, retry and independently read the deletion result.

Automated coverage: `review-list.spec.ts`, `workspace-choices.spec.ts`, `workspace-selection.spec.ts`, `inventory-state.spec.ts`, `archive-review.spec.ts`, `review-list.spec.ts`.

## Gotchas

- Merged/closed PR reviews and manually closed reviews without a PR appear only in Closed. Update offers are covered by [Updates](access.updates.md).
- Selecting/archiving must retain document-leave protection. Tablet presentation requires its own proof.

### Unavailable pull request state

With a linked PR read pending, Worktrees shows Reading worktrees and keeps the review visible, including a main-checkout review. Fail that read or return a typed unavailable reason: the review stays in Needs you, its full accessibility label includes the reason, and the list displays the persistent reason with Read projects again. The review detail also explains the failure and offers Read pull request again. Restore a merged/closed PR and retry: Closed contains the recovered review with Archive, which opens the normal confirmation. Cancel keeps the checkout. Check both themes, long names, return navigation and the failure/retry path.

Retry also reads main-checkout PRs that previously succeeded as open and left the status groups. If a later read fails, the review returns to Needs you with its reason; if it becomes merged or closed, Closed offers Archive.
