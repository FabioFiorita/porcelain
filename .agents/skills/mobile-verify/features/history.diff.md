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

Open a changed file from commit detail. The native file renderer shows the path, status and the patch with old/new line numbers. Only this file's paths are requested, preserving both paths of a rename. On phones, Back and edge swipe return to the commit, then the list. On iPad, files opened from History activate diff tabs in the same workspace. The selected environment, project, worktree, commit and merge parent scope every read.

Check multiple hunks and added/deleted files against an independent server patch. Binary, metadata-only, omitted and empty changes explicitly show why code is unavailable. An invalid patch shows The patch could not be parsed with Retry; a read error shows Couldn't load diff. Missing files and patches have explicit unavailable states. History diffs are read-only; line comments belong to Review.

On iPad a changed file opens a tab scoped by commit, comparison parent and path. Opening the same file comparison again activates that tab; the same path at another commit or merge parent opens a distinct tab. Select the commit tab to return and confirm its parent is retained. Switch and close tabs, then narrow and widen the workspace with the diff active. The History native title and workspace toolbar must remain intact, and list/file selections must not push native routes. Existing direct diff routes retain their navigation behavior.
