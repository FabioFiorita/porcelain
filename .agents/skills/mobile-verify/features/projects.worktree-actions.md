---
screen: /worktree-actions
selectors:
  - 'Copy worktree path'
  - 'Switch branch'
  - 'Find a branch'
  - 'Review deletion'
  - 'Delete'
  - 'Retry changes'
  - 'Worktree unavailable'
  - 'Close'
tests:
  - packages/client/src/features/projects/rules/worktree-actions.spec.ts
  - packages/git/src/actions/commands/cleanup-worktree.spec.ts
  - apps/mobile/src/features/projects/rules/worktree-action-selection.spec.ts
api:
  - POST /api/worktrees/:worktreeId/delete
  - POST /api/worktrees/:worktreeId/git/actions
---

# projects.worktree-actions

Long-pressing a worktree card in Worktrees opens its actions as a form sheet route (`/worktree-actions` with the computer, worktree and action kind as parameters). The sheet is titled with the worktree name and offers Copy worktree path, Switch branch and, on non-main worktrees, Delete; Retry changes appears while its changes are unavailable. Switch branch and Delete replace the body and title within the same sheet.

## How to get to it (user POV)

- Worktrees → long-press a worktree card.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Long-press a worktree card. The sheet covers the tab bar with rounded top corners; iOS shows the title and an X (Close) in the native header with a grabber, Android an in-sheet header with a drag handle, the title and an X. There is no Cancel button. Close and swipe-down each dismiss it back to Worktrees with the selection unchanged.
2. Follow [worktree and project actions](projects.worktrees.md) for Copy worktree path, Switch branch and Delete. Their forms keep the primary action (Switch branch, Review deletion then Delete) and dismiss with Close or swipe-down. A completed switch or deletion closes the sheet.

Automated coverage: `worktree-actions.spec.ts`, `cleanup-worktree.spec.ts`, `worktree-action-selection.spec.ts`.

## Gotchas

- The sheet resolves the worktree from the live navigator by computer and worktree ID and keeps the last entry it saw, so a worktree removed by its own Delete stays readable until the sheet closes; opening it for a worktree that is not listed shows Worktree unavailable.
