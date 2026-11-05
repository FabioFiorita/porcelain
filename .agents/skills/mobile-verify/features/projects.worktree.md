---
screen: /worktree
selectors:
  - 'worktree-screen'
  - 'worktree-review'
  - 'worktree-files'
  - 'worktree-history'
  - 'worktree-pull-request'
  - 'No published review'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
api:
  - GET /api/inventory
---

# projects.worktree

Tapping a worktree in Worktrees selects it as the workspace and pushes its Worktree screen, titled with the worktree and captioned "project · computer". It offers Review (with its review progress, or No published review), Files, History and, when its review links a pull request, Pull request #n; each opens that destination for the selected worktree inside the Worktrees tab.

## How to get to it (user POV)

- Worktrees tab → tap a worktree card.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. In Worktrees tap a worktree: the Worktree screen pushes with its title, project/computer caption and rows. Independently read the saved selection: that worktree and computer are selected.
2. `worktree-review` shows the same progress as the card (or No published review) and opens [Review](reviews.review.md). Back returns here. Repeat with `worktree-files` ([Files](files.files.md)) and `worktree-history` ([History](history.history.md)).
3. For a review linked to a PR, `worktree-pull-request` reads Pull request #n and opens the [PR document](reviews.pull-request.md); without a link the row is absent.
4. Back returns to Worktrees with its search, filters and expansion. Tap another worktree: the screen and every destination follow the new selection.
5. Check long names, larger text, and tablets in landscape and portrait.

Automated coverage: `workspace-selection.spec.ts`.

## Gotchas

- The rows reflect the card at the moment it was tapped; destinations read the current workspace. Selection failures stay on Worktrees: see [Worktrees](projects.worktrees.md#driving-it-with-agent-device).
