---
screen: /history
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'History'
  - 'Select a commit'
  - 'Select a worktree to continue.'
  - 'No commits yet'
  - "Couldn't load history"
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/commits
---

# history.history

History uses the selected environment, project and worktree and the shared live history reader. It follows the branch or detached HEAD, loads older commits as the list reaches its end, and shows restart, shallow-clone and wide-frontier boundaries. No selection shows Select a worktree to continue.; an unborn branch shows No commits yet. Read failures offer Retry.

Open the native History tab or porcelain.dev://history. Select a worktree through its native toolbar menu. Open a commit row; return with the native back button or swipe. Switch worktrees through the toolbar and confirm history belongs to the new selection. Add a commit through the disposable fixture and confirm the live reader updates. Scroll a repository with more than one page until older commits and the boundary appear. Disconnect the disposable server and confirm an error and working retry after recovery.

The destinations spec protects the unpaired deep link. The named History spec protects paired browsing and native back navigation. Pagination, live update and error recovery need native verification against the disposable server. iPad and Android are not proved by an iPhone run.

See [selected workspace states](projects.workspace-picker.md#selected-workspace-states) for shared loading, failure, availability and recovery behavior.

On iPad with at least 700 points available after the app sidebar, History keeps its commit list beside the native detail stack. The History route initially asks Select a commit. Choosing a row highlights its route OID and opens commit detail; choosing another replaces that detail. Opening a file keeps the list beside the diff. Choosing a commit from the diff returns through its commit before replacing the detail, so Back returns to History without a chain of old selections.

Resize with a commit and then a diff open, and toggle the app sidebar beside the wide History heading. The detail toolbar owns that toggle only in compact mode. Below the available-width threshold, the existing native list, commit and diff routes remain full width with Back and edge swipe. Return to History, switch worktrees, and confirm no row from the old workspace remains selected. Exercise list loading, empty, read failure, live restart and pagination in the wide pane as well as compact presentation. An iPhone run does not prove this iPad presentation.
