---
screen: /history
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'History'
  - 'Choose a document'
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

Open the native History tab or porcelain.dev://history. Select a worktree through its native toolbar menu. On a phone, open a commit row; return with the native back button or swipe. On iPad, choose History in the right inspector; a commit row opens or activates a tab in the central workspace shared with Files and Review. Switch worktrees through the phone toolbar or iPad left navigator and confirm history belongs to the new selection. Add a commit through the disposable fixture and confirm the live reader updates. Scroll a repository with more than one page until older commits and the boundary appear. Disconnect the disposable server and confirm an error and working retry after recovery.

The destinations spec protects the unpaired deep link. The named History spec protects paired browsing and native back navigation. Pagination, live update and error recovery need native verification against the disposable server. iPad and Android are not proved by an iPhone run.

See [selected workspace states](projects.workspace-picker.md#selected-workspace-states) for shared loading, failure, availability and recovery behavior.

On iPad, History is a right inspector mode, and commits and diffs share the central closable document tabs with Files and Review. Wide panes show the inspector on the right; narrow panes switch inspector/content in place. Opening a row or changed file must not push a native route. An empty central area asks Choose a document.

Open two commits and a commit diff, then switch the inspector to Files and Review. The central document and every tab remain. Close and reopen tabs, change a merge parent and revisit its commit, hide/show the inspector, and resize. The native title identifies the project/worktree; both sidebar and inspector controls stay available. Visit Settings and switch away from and back to this worktree: its own session returns. Exercise loading, empty, failure, live restart and pagination in the retained inspector. An iPhone run does not prove this iPad presentation. See [app.workspace](app.workspace.md).
