---
screen: /
selectors:
  - 'Worktrees'
  - 'Settings'
  - 'Close Settings'
  - 'worktree-navigator'
  - 'Select a worktree'
  - 'Show worktrees'
  - 'Hide worktrees'
tests:
  - apps/mobile/src/shared/rules/list-detail.spec.ts
api: []
---

# app.shell

Phones and tablets open on Worktrees, with one navigation stack and no single-item tab bar. The header gear opens Settings as a modal.

## How to get to it (user POV)

Launch the app, choose a worktree, then Walkthrough or Changes, Files or History. Back returns to Worktrees. Settings opens from the header gear.

## Driving it with agent-device

Cold-launch and confirm Worktrees appears without a tab bar. Open each worktree section and use Back to return. Open Settings and Close Settings. Repeat on a phone and a tablet in both orientations.

## Gotchas

The Worktrees root keeps its native large title; document actions remain in their native top bar.
