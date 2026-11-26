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
  - packages/client/src/features/projects/store/worktree-snapshot.spec.ts
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

Worktrees is the full-page worktree selector, pushed over the tabs from any worktree tab's title button and shown first on a launch with no worktree chosen. Choosing a worktree returns to the tab you came from. Search and the environment/project pickers filter one list of current checkouts; there is no Reviews tab, saved-review row or review-state filter.

After a successful read, the phone saves display rows for the paired computer. On a cold launch, Worktrees can show saved rows in the same project groups with the same scope controls. Saved rows and their project actions are disabled. Saved search uses titles and branch names. Full path search uses live inventory. Screen readers announce saved rows as Saved. Live rows replace the saved rows when inventory arrives. Forgetting the computer removes its snapshot.

To verify, open Worktrees once against a disposable paired computer, hold the server response, then cold-launch the same app profile. Check the project heading, scope controls and disabled saved rows. Release the server and confirm those rows become interactive in the same groups. Open the main worktree and return with Back. Repeat after Forget and confirm the saved rows are gone.

Each project is independently collapsible. Main comes first, then the most recently touched worktrees (the later of the head commit and the last uncommitted change) and undated branches by name. A row leads with its Walkthrough title, else PR title, else branch. Main, detached state, project and computer remain in accessibility labels. Live detached rows also include the full path. Changes show a quiet count explicitly labelled uncommitted, nothing while it is read, or a distinct unavailable state; a failed background read shows no notice. The count does not describe committed branch changes. PR numbers and checks use lightweight GitHub reads; full PR content loads only when opened.

Select a worktree, open Walkthrough or Changes, Files and History, and return through native Back. Settings, computer pairing and project scopes remain reachable. An old open/reviews link returns to Worktrees. Verify phone plus Android tablet in landscape and portrait, including the list beside content in landscape and over it in portrait (see [Worktree](projects.worktree.md) step 6), search, collapse state, selected row, long names and larger text. Report iOS separately.

Long-press a row for Copy path, Switch branch and (except main) Delete. Opening another row's actions preserves selection. Switch labels current and checked-out-elsewhere branches, and a lost response recovers through the same durable request. Deletion uses current computer settings for its initial switches and a fresh guarded preview. Dirty/unpushed work requires acknowledgement. Main/default branches remain protected. Confirm only in disposable fixtures and read Git and filesystem state independently. Removing the selected checkout moves to a surviving main checkout; removing another checkout preserves selection.
