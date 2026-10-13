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

Open the native History tab or porcelain.dev://history. Select a worktree through its native toolbar menu. On a phone, open a commit row; return with the native back button or swipe. On iPad, a commit row opens or activates a tab in the History workspace. Switch worktrees through the toolbar and confirm history belongs to the new selection. Add a commit through the disposable fixture and confirm the live reader updates. Scroll a repository with more than one page until older commits and the boundary appear. Disconnect the disposable server and confirm an error and working retry after recovery.

The destinations spec protects the unpaired deep link. The named History spec protects paired browsing and native back navigation. Pagination, live update and error recovery need native verification against the disposable server. iPad and Android are not proved by an iPhone run.

See [selected workspace states](projects.workspace-picker.md#selected-workspace-states) for shared loading, failure, availability and recovery behavior.

On iPad, History keeps commits and diffs in closable tabs inside the selected workspace. With room for adjacent panes, its commit list remains beside the tab content; without that room, the shared workspace control switches between the list and content in place. Opening a row or changed file must not push a native route. Before any commit is selected, and after the last tab closes, the content asks Select a commit.

Open two commits, switch tabs, close the active tab, then close the last tab. Open a file from a commit and return by selecting its commit tab. Resize with a commit and then a diff active, toggle the app sidebar using History's native header, and use the in-place navigation control at narrow widths. The History title, workspace menu and sidebar control must stay in its native header. Switch worktrees and confirm tabs and selection clear before any old commit can be read against the new workspace. Exercise loading, empty, read failure, live restart and pagination in the list. An iPhone run does not prove this iPad presentation.
