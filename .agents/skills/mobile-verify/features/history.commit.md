---
screen: /history/commit/[oid]
selectors:
  - 'Root commit'
  - 'No changed files'
  - 'Compare parent'
  - "Couldn't load commit"
tests: []
api:
  - GET /api/worktrees/:worktreeId/commits/:oid/files
---

# history.commit

Open a commit from History. Its native stack detail shows the subject, body, author, timestamp, full selectable OID, refs, comparison and changed-file list. Root commits compare against the empty tree. Merge commits offer a native Compare parent menu; choosing another parent reads that comparison before files can open. Renames identify the old path; deletions retain their old path.

Open an added, modified, renamed and deleted file. Return from each diff to the same commit and then to the list using native back navigation. For a merge, choose each parent and independently read its files through the server. Open a root commit and confirm Root commit. A commit without file changes shows No changed files. Read failure offers Retry. Changing workspace in another tab must not read this old commit against the newly selected worktree; the old detail asks the user to return to History.
