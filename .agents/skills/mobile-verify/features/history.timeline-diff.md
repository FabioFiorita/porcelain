---
screen: /timeline-diff
selectors:
  - 'Workspace changed'
  - "Couldn't load diff"
tests: []
api:
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
---

# history.timeline-diff

The existing commit diff reader remains in the Files stack when reached from a file timeline.

Follow [commit diff](history.diff.md) for patch/line/parent and read-only behavior. Enter through Worktrees → worktree → Files → Timeline → commit → changed file. Back/swipe returns to the same commit and parent, then the timeline with its selected row/loaded depth/scroll. A workspace change asks to return to Files. Tablets use this same route; verify it in landscape and portrait.
