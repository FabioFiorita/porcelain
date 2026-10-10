---
screen: /review
selectors:
  - "Review"
  - "Select a worktree to continue."
  - "No changes"
  - "Refresh"
tests:
  - apps/mobile/spec/e2e/phone-shell.e2e.ts
  - apps/mobile/spec/e2e/destinations.e2e.ts
  - apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts
  - apps/mobile/spec/e2e/review.e2e.ts
api:
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

- `apps/mobile/spec/e2e/phone-shell.e2e.ts`: the phone tabs select Review and show its empty state; a cold launch starts on Files.
- `apps/mobile/spec/e2e/destinations.e2e.ts`: the deep link opens Review directly with the tab selected.
- `apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts`: the iPad split shows Review with “Changes” in the content column.
- `apps/mobile/spec/e2e/review.e2e.ts`: the native changed-file flow persists the reviewed fingerprint and file feedback, with independent server readbacks.

## Gotchas

- Agent explanations can refer to context or committed files outside the current comparison. The current changed-file destination explicitly reports No longer changed instead of fabricating a diff.
- iPhone is the authorized native proof target. The existing iPad shell map is retained, but these Review changes do not claim iPad or Android proof.
- agent-device's iOS accessibility backend can omit the selected trait of a native tab; read selection from the screenshot, and leave the selected-state assertion to the Maestro e2e test.
