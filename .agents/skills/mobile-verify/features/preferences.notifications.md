---
screen: /notifications
selectors:
  - 'Notifications'
  - 'settings-notifications'
  - 'notifications-reviewReady'
  - 'notifications-agentReply'
  - 'Reviews ready'
  - 'Agent replies'
  - 'Allow notifications?'
  - 'Open Settings'
tests:
  - packages/client/src/features/notifications/rules/notifications.spec.ts
  - packages/client/src/features/preferences/store/saved-preferences.spec.ts
  - apps/server/spec/integration/access-push-notifications.integration.ts
api:
  - PUT /api/push-registration
  - DELETE /api/push-registration
---

# preferences.notifications

Notifications has two switches, Reviews ready and Agent replies. Turning the first one on explains what Porcelain sends, then asks the phone's permission and requests an Expo push token; the phone registers that token with every paired computer, which then sends one push per published review or agent reply. Turning both off unregisters. Without the app's push credentials the token request fails: the screen says the push key is missing, the switches keep their values and the phone registers by itself once a token is available. Tapping a notification opens its review.

## How to get to it (user POV)

- Settings gear → Notifications (its row summarises Off, Reviews ready, Agent replies or both). Native Back returns to Settings.
- A notification in the system tray opens the review it names, or Reviews when it carries no link.

## Driving it with agent-device

Preconditions: [surface baseline](README.md). A fresh start clears app data, so permission is undetermined.

1. Open Settings → Notifications. The legacy switches remain saved preferences until the mobile deletion.
2. Change each switch, reload the app, and confirm its value persists.
3. Retired review-ready and agent-reply events are unavailable. The shared registration plan clears registrations; neither switch sends a notification or registers an event kind.
4. Turning both off clears the computer registration with `DELETE /api/push-registration` (204).

Automated coverage: `saved-preferences.spec.ts`, `notifications.spec.ts`, and server `access-push-notifications.integration.ts`.
