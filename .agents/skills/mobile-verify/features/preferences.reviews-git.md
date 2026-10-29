---
screen: /reviews-git
selectors:
  - 'Reviews & Git'
  - 'Use these settings for'
  - 'When archiving a review'
  - 'Spec files'
  - 'Pull strategy'
  - 'pull-merge'
  - 'pull-rebase'
  - 'Read settings again'
  - 'Commit model'
  - 'Read models again'
tests:
  - packages/client/src/features/preferences/store.spec.ts
  - packages/client/src/features/preferences/rules/review-git-settings.spec.ts
  - packages/client/src/features/projects/queries/folders.spec.ts
api:
  - GET /api/review-git-settings
  - PATCH /api/review-git-settings
  - GET /api/git/commit-models
---

# preferences.reviews-git

Reviews & Git edits the archive deletions, Spec files and pull strategy that a computer keeps for every device connected to it, plus this app's own commit model.

## How to get to it (user POV)

- Settings → Reviews & Git. Phone Back returns to Settings; iPad General changes category.
- With several paired computers, the Computer choice picks which one is edited; with one, the page names it.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open Reviews & Git against a fresh disposable computer. The switches and Pull strategy are disabled and show this app's earlier values; choose Use these settings for <computer name>. They enable; GET `/api/review-git-settings` answers `configured` with those values.
2. Toggle an archive deletion and choose Rebase. Read the setting from a browser on the same computer: it changed there too. Change a different setting from the browser and reopen the page: both changes stay.
3. Pair a second disposable computer: the Computer choice lists both and each keeps its own values.
4. Stop the server while the page is open and reopen it: the error offers Read settings again and the controls show no values (switches off, no Pull strategy selected) rather than this app's earlier values; after restarting, it restores the controls.
5. Choose an installed Commit model grouped by provider; it stays on this device. A saved missing model must not silently overwrite the saved preference; read failure offers Read models again.
6. Preview archive through [Worktrees](projects.workspace-picker.md): deletion choices agree with the computer's settings, and Archive is disabled with the reason until they are confirmed.

Automated coverage: `review-git-settings.spec.ts`, `store.spec.ts`, `folders.spec.ts`.

## Gotchas

- An untrusted device reached over the local network or a remote route can read but not change the computer's settings: the import button is disabled with that reason, and a refused change explains it. While device trust is unknown or its refresh failed, import stays disabled with the trust-confirmation reason and Check again. A failed Check again keeps the retry available; a successful read enables import only if the computer trusts the device.
- If the computer already kept another device's import, choosing Use these settings shows the computer's values and says that computer already had settings and yours weren’t used.
- Mobile has no Pull action; pull strategy is used by the web and desktop Git menu.
