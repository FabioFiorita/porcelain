---
screen: /history
selectors:
  - 'History'
  - 'Select a worktree to continue.'
  - 'No commits yet'
  - "Couldn't load history"
tests: []
api:
  - GET /api/worktrees/:worktreeId/commits
---

# history.history

History uses the selected environment, project and worktree and the shared live history reader. It follows the branch or detached HEAD, loads older commits as the list reaches its end, and shows restart, shallow-clone and wide-frontier boundaries. No selection shows Select a worktree to continue.; an unborn branch shows No commits yet. Read failures offer Retry.

Open the native History tab or porcelain.dev://history. Select a worktree through its native toolbar menu. Open a commit row; return with the native back button or swipe. Switch worktrees through the toolbar and confirm history belongs to the new selection. Add a commit through the disposable fixture and confirm the live reader updates. Scroll a repository with more than one page until older commits and the boundary appear. Disconnect the disposable server and confirm an error and working retry after recovery.

The destinations spec protects the unpaired deep link. The named History spec protects paired browsing and native back navigation. Pagination, live update and error recovery need native verification against the disposable server. iPad and Android are not proved by an iPhone run.
