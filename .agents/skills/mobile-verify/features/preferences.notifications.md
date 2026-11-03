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

1. Open Settings: the Notifications row says Off. Open it: both switches are off and the footer says what each computer sends through Expo.
2. Turn on Reviews ready: Allow notifications? explains first; Not now leaves it off. Continue shows the system permission prompt; Allow. Without push credentials the screen shows "Notifications need the app's push key — they'll start working once it's configured." and the Computers card says each computer registers once the phone has a notification token.
3. Turn on Agent replies, relaunch through the Metro URL in [driving](../references/driving.md) and reopen: both switches stay on, the Settings row says Reviews ready and agent replies and the push-key message returns without a new prompt.
4. Revoke the notification permission (Android: `adb shell pm revoke <package> android.permission.POST_NOTIFICATIONS`, flag it user-fixed) and relaunch: the screen says notifications are off in the phone's settings and Open Settings opens the app's system settings. Grant it there and return: the push-key message replaces it.
5. Turn both switches off: the computer receives `DELETE /api/push-registration` (204 in the instance's request log).
6. With push credentials, a token registers instead: each computer row says Notifies this phone. Publish with `$C agent publish-review`, post a comment from the app and answer it with `$C agent reply`; `$C server push-requests` lists each message sent to the fixture's fake push service, and a tap on the delivered notification opens the review.

Automated coverage: `notifications.spec.ts` (plan, token failures, messages, tap route), `saved-preferences.spec.ts` (saved switches), and the server's `access-push-notifications.integration.ts` (register, publish, reply, unregister, dropped tokens).

## Gotchas

- Android 13 shows the permission prompt only after a notification channel exists; the app creates the Reviews and replies channel before asking.
- Forgetting a computer clears this phone's registration there first, bounded by a short timeout; if the computer is unreachable, pairing it again moves the same token to the new device instead of duplicating it.
- A failed registration retries when the app returns to the foreground.
- Registration from the device is not observable on a build without push credentials; step 6 needs a credentialed build.
