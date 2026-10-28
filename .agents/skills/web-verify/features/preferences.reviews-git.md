---
route: /settings/$section
selectors:
  - 'Reviews & Git'
  - 'Use these settings for this computer'
  - 'Computer'
  - 'Spec files'
  - 'Pull strategy'
  - 'When archiving a review'
  - 'Read settings again'
  - 'Update this computer to sync settings'
  - 'GitHub account for pull requests'
  - 'GitHub account for'
  - 'Use the detected account for'
tests:
  - apps/web/spec/e2e/reviews-spec-files.e2e.ts
  - apps/server/spec/integration/access-review-git-settings.integration.ts
  - packages/client/src/features/preferences/rules/review-git-settings.spec.ts
  - packages/client/src/features/reviews/queries/pull-requests.spec.ts
api:
  - GET /api/review-git-settings
  - PATCH /api/review-git-settings
  - GET /api/projects/:projectId/github-account
  - PUT /api/projects/:projectId/github-account
---

# preferences.reviews-git

Reviews & Git settings (Spec files, Pull strategy and the three archive deletions) belong to a computer: every device connected to it reads and changes the same values. A computer starts unconfigured; the first device shows the values it kept before as a preview and saves them only when the developer chooses Use these settings for this computer. Two devices changing different settings both keep their change; the same setting keeps the last change.

## How to get to it (user POV)

- Settings → Reviews & Git. With paired remote computers, the Computer picker chooses which computer is being edited; a plain browser edits only its own computer.
- The Git menu's Pull and a review's Archive use the worktree's computer and wait until its settings are confirmed.

## Driving it with browser

Preconditions: [surface baseline](README.md).

1. On a fresh instance open Settings → Reviews & Git. Every control is disabled and shows this browser's earlier values; the notice explains the computer has no settings yet. A browser that never chose them shows Merge, Spec files off and all three deletions on. The Git menu's Pull and Archive are disabled with "Choose Reviews & Git settings for this computer in Settings first."
2. Choose Use these settings for this computer. The notice goes and the controls enable. `$C server` GET `/api/review-git-settings` answers `configured` with revision 1 and the previewed values.
3. Change Pull strategy to Rebase in one tab and Delete remote branch off in a second tab of the same browser; both tabs converge on both changes without reloading.
4. Pair a second device through the server CLI without trust and PATCH a change with its bearer from another origin: 403 "An owner must trust this device…". The browser on this computer can still change settings.
5. Stop the server while Settings is open: controls disable and the destructive notice offers Read settings again; Pull and Archive stay disabled. Restart and Read settings again restores them.
6. Pair a remote computer and reopen Reviews & Git: the Computer picker names This computer and the remote. Its settings are separate; switching computers never shows the other computer's values.
7. In GitHub account for pull requests, each GitHub project shows its repository and the account detected by `gh`. Choose another signed-in account: the badge becomes Chosen. Use the detected account for the project clears the override and restores Detected. The choice is saved on the project's computer, for every device. Non-GitHub projects have no row.
8. A project no signed-in account can read shows No signed-in account can open it. A missing `gh` offers How to install, no signed-in accounts offers Copy gh auth login, and transient GitHub failures offer Try again. Request failures show Could not display the GitHub account with Try again. Check long project names, repository names and accounts at phone width in light and dark.

Automated coverage: `reviews-spec-files.e2e.ts` (import then change), `access-review-git-settings.integration.ts` (contract, trust, merge), `review-git-settings.spec.ts` (view states).

## Gotchas

- An older computer without the route shows Update this computer to sync settings and keeps Pull and Archive disabled for it.
- The preview values come from this browser's old local preferences and never change after the upgrade; General settings stay on this device.
