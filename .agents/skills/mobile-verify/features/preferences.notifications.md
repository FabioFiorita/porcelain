---
screen: /notifications
selectors:
  - 'Notifications'
  - 'settings-notifications'
  - 'Porcelain currently sends no push notifications.'
tests:
  - packages/client/src/features/preferences/store/saved-preferences.spec.ts
  - apps/server/spec/integration/access-push-notifications.integration.ts
api:
  - DELETE /api/push-registration
---

# preferences.notifications

The Notifications settings page explains that Porcelain currently sends no push notifications. Old saved switches are ignored on read and omitted when preferences are next saved. The phone clears any old registrations with each paired computer. Tapping a previously delivered notification returns to Worktrees.

## How to get to it (user POV)

Settings gear → Notifications. The row says Unavailable. Native Back returns to Settings.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open Settings → Notifications. Confirm the explanation and the absence of notification switches and permission actions. Press Back to return to Settings.
2. With both legacy switches present in saved preferences, relaunch. Confirm the Settings row still says Unavailable and other saved preferences remain.
3. Verify the paired computer accepts registration cleanup through `DELETE /api/push-registration` (204). If a previously delivered notification is available, tap it with the app warm and cold. Confirm Worktrees opens in both cases.
