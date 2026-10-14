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

Open a commit from History. Its detail shows the subject, body, author, timestamp, full selectable OID, refs, comparison and changed-file list. Root commits compare against the empty tree. On both devices, merge commits offer the neutral in-content Compare parent menu; choosing another parent reads that comparison before files can open. Renames identify the old path; deletions retain their old path.

Open an added, modified, renamed and deleted file. Return from each diff to the same commit and then to the list using native back navigation. For a merge, choose each parent and independently read its files through the server. Open a root commit and confirm Root commit. A commit without file changes shows No changed files. Read failure offers Retry. Changing workspace in another tab must not read this old commit against the newly selected worktree; the old detail asks the user to return to History.

On iPad, selecting a commit opens or activates its tab. Select two commits through the list; opening one again must activate its existing tab. Merge commits offer an in-content native Compare parent menu, leaving the project/worktree title and sidebar/inspector toolbar intact. Change the parent, switch to another tab and back, and confirm the comparison parent is retained. Open a file, then return by selecting the commit tab; renames, deletions and root comparisons must keep their existing semantics. Close all central tabs and confirm Choose a document. Narrow and widen the workspace while a commit is active; the same tab and parent remain selected. Existing direct commit routes retain their navigation behavior.

Commit tabs share the central workspace with Files and Review. Switching inspector modes and visiting Settings retain the selected parent; returning to the worktree restores its own commit and diff tabs.
