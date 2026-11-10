---
screen: /archive-pull-request
selectors:
  - 'Archive'
  - 'Archive pull request'
  - 'Checking the worktree and branches…'
  - 'I understand the risk of losing changes and commits'
  - 'Pull request unavailable'
tests:
  - packages/git/src/actions/commands/cleanup-worktree.spec.ts
api:
  - POST /api/projects/:projectId/pull-requests/:number/archive
  - GET /api/projects/:projectId/pull-requests/:number
---

# projects.archive-pull-request

Archive on a merged or closed PR opens a native confirmation sheet. Settings on the PR's computer supply the worktree, local branch and remote branch options. Until settings are confirmed, Archive is disabled and explains why.

Preview lists the actual deletion targets and discloses ignored files. Cancel or swipe down preserves all Git state. Dirty or unpushed work requires acknowledgement. Main checkout and branches stay protected. Confirming moves selection to the surviving main checkout before deleting the topic checkout. A kept worktree remains in its project.

Verify locked-worktree refusal, fresh preview and retry, ignored files, long paths and larger system text. Independently read Git and the filesystem. On Android phone and tablet, portrait and landscape, the confirmation and destructive button stay reachable. Report iOS separately.
