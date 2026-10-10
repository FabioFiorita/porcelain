---
screen: /history/commit/[oid]/diff
selectors:
  - 'Diff unavailable'
  - "Couldn't load diff"
  - 'The patch could not be parsed'
  - 'No code change'
api:
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
tests: []
---

# history.diff

Open a changed file from commit detail. The native file renderer shows the path, status and the patch with old/new line numbers. Only this file's paths are requested, preserving both paths of a rename. Back and edge swipe return to the commit, then the list. The selected environment, project, worktree, commit and merge parent scope every read.

Check multiple hunks and added/deleted files against an independent server patch. Binary, metadata-only, omitted and empty changes explicitly show why code is unavailable. An invalid patch shows The patch could not be parsed with Retry; a read error shows Couldn't load diff. Missing files and patches have explicit unavailable states. History diffs are read-only; line comments belong to Review.
