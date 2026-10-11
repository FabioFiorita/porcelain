---
screen: /history
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'History'
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

Files, Review and History share the workspace gate: saved storage and the first inventory show Reading workspace…; inventory failures show their message and Read again, which refreshes the inventory; unavailable or missing saved projects/worktrees show Workspace unavailable and the most specific reason supported by the inventory. Only loaded saved state with no choice says Select a worktree to continue. The native workspace toolbar remains reachable in each state. See projects.workspace-picker for driving these states.
