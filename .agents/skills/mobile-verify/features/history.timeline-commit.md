---
screen: /timeline-commit
selectors:
  - 'Root commit'
  - 'No changed files'
  - "Couldn't load commit"
tests: []
api:
  - GET /api/worktrees/:worktreeId/commits/:oid/files
---

# history.timeline-commit

An older file-timeline row opens the existing read-only commit view inside the Files stack.

Follow [commit details](history.commit.md) for metadata, full SHA, refs, parent and file-list readbacks. Enter through Files → Timeline → row; the historical path is selected. Opening a file carries the chosen parent to [the timeline diff](history.timeline-diff.md). Phone Back/swipe returns to the exact timeline, then the source file. A workspace change asks to return to Files instead of reading the old OID in the new worktree.

iPad uses its existing commit document rather than this phone route; verify the same data and return promises through central tabs.
