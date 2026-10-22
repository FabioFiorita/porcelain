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

Worktrees lists projects and reviews across paired computers, with search, status filters, retained closed reviews and guarded archive.

## Sub-features

- `projects.workspace-picker` — Worktree selection, filters, status and archive.

## How to get to it (user POV)

- Workspace header in Review, Files or History → Worktrees; iPad sidebar selects worktrees.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

Preconditions: seed active checkouts, reviews in every status and one closed review on the disposable server.

1. From Review tap workspace header: Worktrees with native Back, icon-only Filter worktrees/Closed reviews, no Choose workspace modal/Close. Repeat from Files/History. iPad uses its embedded navigator.
2. Projects is first (one main checkout/project, never duplicated in status groups), then Needs you, Waiting on agent, Ready to merge, No review (non-main unreviewed checkouts only). Verify counts against server marks/reviews. Unavailable checkouts are disabled.
3. Rows have one-line truncated title, trailing muted reviewed/total count; second line has one status icon, project only when multiple projects survive filters, branch and single-line computer Badge without separators. No review uses project as title; Projects keeps branch/computer below. Full reasons/metadata remain accessible/searchable and in details, including unexplained count/paths; no age/reason badges/row chevron. Check long names, Search/icon and indentation.
4. Collapse two groups independently, search/clear, leave/reopen, force-stop/relaunch: choices persist. Reopen one without changing the other. Search title, branch, project, computer, PR and folder: Projects also filters, no matches is explicit, clearing preserves selection.
5. Filter worktrees has inline Projects/Computers checkbox sections. Filters intersect; deselecting the last shows no rows; Clear filters restores all. Closed shows only one Closed heading above the list, retained reviews remain readable; native Back returns to origin. Selecting an active checkout returns with workspace changed and draft guard intact.
6. Retain expanded/collapsed/filter/Closed screenshots and Android recording; independently read records.

### Archive a completed review

Precondition: review linked to merged/closed PR. In Settings → Reviews & Git, When archiving a review has worktree/local branch/remote branch switches, all default on.

1. Row Archive shows actual deletion targets. Cancel: no deletion. Keeping a worktree while deleting its branch explicitly detaches it; main checkout/branches stay protected.
2. Dirty files/unpushed commits require their warning/acknowledgement; Android switch starts off and Archive stays disabled until checked. Ignored files alone are not dirty. No upstream skips remote deletion; auto-deleted remote at the merged PR head says already deleted without an unpushed warning. Failed preview replaces checking text with a plain reason.
3. Confirm for the selected worktree: selection leaves before deletion. Closed retains readable review and Archived in accessible label/detail. A kept worktree remains under No review (Projects for main). Capture before, confirmation, Closed and settings.

Automated coverage: `review-list.spec.ts`, `workspace-choices.spec.ts`, `workspace-selection.spec.ts`, `inventory-state.spec.ts`, `archive-review.spec.ts`, `review-list.spec.ts`.

## Gotchas

- Merged/closed PR reviews and manually closed reviews without a PR appear only in Closed. Update offers are covered by [Updates](access.updates.md).
- Selecting/archiving must retain document-leave protection. Tablet presentation requires its own proof.
