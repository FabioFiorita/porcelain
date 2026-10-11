---
screen: /review
selectors:
  - 'Reading workspace…'
  - 'Workspace unavailable'
  - 'Read again'
  - 'Review'
  - 'Select a worktree to continue.'
  - 'No changes'
  - 'Refresh'
tests:
  - packages/client/src/features/projects/rules/workspace-selection.spec.ts
api:
  - GET /api/inventory
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/branch-changes
  - GET /api/worktrees/:worktreeId/branch-bases
  - GET /api/worktrees/:worktreeId/review
  - GET /api/worktrees/:worktreeId/reviewed
  - GET /api/worktrees/:worktreeId/comments
---

# reviews.review

## What it is

Review uses the selected worktree and shared live subscriptions to show uncommitted or branch changes, fingerprint-aware reviewed markers, an agent's published explanation and comments. It uses native comparison menus, stack navigation and a comments sheet with Porcelain content primitives.

## How a user reaches it

- the app opens on Files after a cold launch
- phone: the Review tab; iPad: Review in the sidebar
- the deep link `porcelain.dev://`

## Driving it

1. Open Review without a worktree. Expect Select a worktree to continue.
2. Pair the disposable server and choose its sample worktree from the existing Workspace toolbar. Expect Review README.md. Open it, then use the native Back control to return to the same list.
3. Choose Branch from the Uncommitted menu, choose a base from Compare against, and inspect its files. Return to Uncommitted. Marks and comments retain their comparison scope.
4. Change the sample through fixture operations. Expect the list and reviewed status to update without leaving Review. A previous fingerprint reads Changed since review; a clean worktree reads No changes.
5. Revoke or stop the disposable environment. Expect an error or unavailable-workspace state; no old workspace's writes remain available. Read again through the workspace toolbar after reconnecting.
6. Select Files and return; cold-launch against the card's Metro URL and return to Review. The selected workspace remains the shell's responsibility.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- Agent explanations can refer to context or committed files outside the current comparison. The current changed-file destination explicitly reports No longer changed instead of fabricating a diff.
- iPhone is the authorized native proof target. The existing iPad shell map is retained, but these Review changes do not claim iPad or Android proof.

Files, Review and History share the workspace gate: saved storage and the first inventory show Reading workspace…; inventory failures show their message and Read again, which refreshes the inventory; unavailable or missing saved projects/worktrees show Workspace unavailable and the most specific reason supported by the inventory. Only loaded saved state with no choice says Select a worktree to continue. The native workspace toolbar remains reachable in each state. See projects.workspace-picker for driving these states.
