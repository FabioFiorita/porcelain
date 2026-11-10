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

An older file-timeline row opens the commit page inside the Files stack.

Follow [commit details](history.commit.md) for metadata, full SHA, refs, parent and file-list readbacks. Enter through Worktrees → worktree → Files → Timeline → row; the page opens scrolled to the historical path's heading. Opening a file carries the chosen parent to [the timeline diff](history.timeline-diff.md). Phone Back/swipe returns to the exact timeline, then the source file. A workspace change asks to return to Files instead of reading the old OID in the new worktree.

Tablets use this same route; verify it in landscape and portrait.
