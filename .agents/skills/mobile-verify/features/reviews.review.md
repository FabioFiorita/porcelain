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

Review uses the selected worktree and shared live subscriptions to show uncommitted or branch changes, fingerprint-aware reviewed markers, an agent's published explanation and comments. It uses native comparison menus, stack navigation and a comments sheet with Porcelain content primitives. On iPad, Overview and changed files open workspace tabs without pushing native file routes. When the available pane is at least 700 points wide, navigation stays beside the selected tab; narrow panes switch between navigation and content in place. Overview cannot be closed; file tabs can be switched and closed. Phones retain the list and native file routes.

## How a user reaches it

- the app opens on Files after a cold launch
- phone: the Review tab; iPad: Review in the sidebar
- the deep link `porcelain.dev://`

## Driving it

1. Open Review without a worktree. Expect Select a worktree to continue.
2. Pair the disposable server and choose its sample worktree from the existing Workspace toolbar. Expect Review README.md. On a phone, open it and use native Back to return to the same list. On iPad, expect Overview initially selected; open README.md and another changed file as tabs, switch between them, close one, and select Overview. Opening the same file twice leaves one tab. Overview has no close action. In a narrow pane, use the Changed files control to return to navigation, then select a destination to show content in place. The native header stays Review. Opening Comments and using Done returns to that same tab.
3. Choose Branch from the Uncommitted menu, choose a base from Compare against, and inspect its files. Return to Uncommitted. Marks and comments retain their comparison scope. Changing comparison or base resets the iPad tabs to Overview; changing workspace clears the previous workspace's tabs.
4. Change the sample through fixture operations. Expect the list and reviewed status to update without leaving Review. A previous fingerprint reads Changed since review; a clean worktree reads No changes.
5. Revoke or stop the disposable environment. Expect an error or unavailable-workspace state; no old workspace's writes remain available. Read again through the workspace toolbar after reconnecting.
6. Select Files and return; cold-launch against the card's Metro URL and return to Review. The selected workspace remains the shell's responsibility.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- Agent explanations can refer to context or committed files outside the current comparison. The current changed-file destination explicitly reports No longer changed instead of fabricating a diff.
- Pane width is measured after the app sidebar consumes its space. A wide phone still uses native file routes; Android keeps its existing compact presentation. Resize the iPad pane across the threshold and verify the same tabs and active content remain, with no native file-route push.
- Native acceptance requires driving the changed iPad presentation and existing compact flow; source inspection does not establish either.

See [selected workspace states](projects.workspace-picker.md#selected-workspace-states) for shared loading, failure, availability and recovery behavior.
