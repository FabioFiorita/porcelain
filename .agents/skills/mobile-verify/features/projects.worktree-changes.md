---
screen: /worktree-changes
selectors:
  - 'Changes'
  - 'Changed files'
  - 'review-all-changes'
  - 'Workspace changed'
tests:
  - apps/mobile/src/features/projects/rules/worktree-section.spec.ts
api:
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/reviewed
---

# projects.worktree-changes

On a worktree whose first section is Walkthrough, the plain Changes list (Uncommitted or Branch, the changed files with their reviewed marks, All changes) is one push away from the Walkthrough's top bar, so uncommitted work stays readable on the phone.

## How to get to it (user POV)

- Worktrees → a worktree with a walkthrough → Walkthrough → the top-bar Changes button. Native Back returns to the Walkthrough at the same place.

## Driving it with agent-device

Preconditions: [Walkthrough](reviews.walkthrough-page.md) on a branch with commits.

2. Edit a file in `$REPO`: Uncommitted lists it. Open it, Back, then Back again returns to the Walkthrough.
3. On a tablet the button sits in the worktree's top bar in landscape and portrait.

## Gotchas

- A worktree without commits shows the same list as its first segment instead.
