---
screen: /reviews-git
selectors:
  - 'Reviews & Git'
  - 'When archiving a review'
  - 'Pull strategy'
  - 'pull-merge'
  - 'pull-rebase'
  - 'Commit model'
  - 'Read models again'
tests:
  - packages/client/src/features/preferences/store.spec.ts
  - packages/client/src/features/projects/queries/folders.spec.ts
api:
  - GET /api/git/commit-models
---

# preferences.reviews-git

Reviews & Git saves archive deletion choices, pull strategy and a commit model for this app.

## How to get to it (user POV)

- Settings → Reviews & Git. Phone Back returns to Settings; iPad General changes category.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open Reviews & Git. Toggle all three archive deletion switches; choose Merge/Rebase and an installed Commit model grouped by provider. Independently read porcelain-preferences.db, cold-launch and confirm values without changing other preferences.
2. Phone Back or iPad General leaves; General has no archive controls. Reopen: values stay.
3. Choose another disposable computer/workspace with different models: show its catalogue. A saved missing model must not silently overwrite the saved preference. No workspace asks to open one; read failure offers Read models again; empty catalogue explains installation/sign-in.
4. Preview archive through [Worktrees](projects.workspace-picker.md): deletion choices agree with settings. Refused preference reads/writes preserve saved values, disable controls and recover through Read saved preferences again.

Automated coverage: `store.spec.ts`, `folders.spec.ts`.

## Gotchas

- Preferences are local. Mobile has no Pull/commit-draft action consuming these defaults, so storage proof does not establish execution.
