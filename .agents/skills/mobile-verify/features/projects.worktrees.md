---
screen: /worktrees
selectors:
  - 'Worktrees'
  - 'Worktrees by project'
  - 'Search worktrees'
  - 'All environments'
  - 'All projects'
  - 'No environments'
  - 'No projects'
  - 'Open pull request #'
  - 'No matching worktrees'
  - 'No computers paired'
  - 'Add computer'
  - 'current'
  - 'Remove from Porcelain'
  - 'Read projects again'
tests:
  - packages/client/src/features/projects/rules/worktree-navigator.spec.ts
  - packages/client/src/features/projects/store/worktree-navigator.spec.ts
  - packages/client/src/features/projects/queries/worktree-navigator.spec.ts
  - packages/client/src/features/projects/rules/workspace-choices.spec.ts
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
  - packages/client/src/features/projects/queries/inventory-state.spec.ts
  - packages/git/src/actions/commands/cleanup-worktree.spec.ts
  - packages/client/src/features/projects/rules/worktree-actions.spec.ts
  - apps/mobile/src/features/projects/rules/worktree-row.spec.ts
  - apps/mobile/src/features/projects/rules/worktree-action-selection.spec.ts
api:
  - POST /api/projects/:projectId/pull-requests/:number/archive
  - POST /api/worktrees/:worktreeId/delete
  - POST /api/worktrees/:worktreeId/git/actions
  - GET /api/projects/:projectId/pull-requests/:number
  - GET /api/projects/:projectId/pull-requests/:number/checks
  - GET /api/worktrees/:worktreeId/git/status
  - POST /api/inventory/refresh
  - GET /api/inventory
  - POST /api/live/tickets
  - GET /api/live
  - GET /api/worktrees/:worktreeId/git/receipts/:requestId
---

# projects.worktrees

Worktrees is the mobile root stack, with no one-item tab bar. Settings is the native header gear. Search and the environment/project pickers filter one list of current checkouts; there is no Reviews tab, saved-review row or review-state filter.

Each project is independently collapsible. Main comes first, then newest head commit and undated branches by name. A row leads with its Walkthrough title, else PR title, else branch. Main, detached state, full detached path, project and computer remain in accessibility labels. Changes show a quiet count or a distinct pending/unavailable state. PR numbers and checks use lightweight GitHub reads; full PR content loads only when opened.

Select a worktree, open Walkthrough or Changes, Files and History, and return through native Back. Settings, computer pairing and project scopes remain reachable. An old open/reviews link returns to Worktrees. Verify phone plus Android tablet in landscape and portrait, including the list beside content in landscape and over it in portrait (see [Worktree](projects.worktree.md) step 6), search, collapse state, selected row, long names and larger text. Report iOS separately.

Long-press a row for Copy path, Switch branch and (except main) Delete. Opening another row's actions preserves selection. Switch labels current and checked-out-elsewhere branches, and a lost response recovers through the same durable request. Deletion uses current computer settings for its initial switches and a fresh guarded preview. Dirty/unpushed work requires acknowledgement. Main/default branches remain protected. Confirm only in disposable fixtures and read Git and filesystem state independently. Removing the selected checkout moves to a surviving main checkout; removing another checkout preserves selection.
