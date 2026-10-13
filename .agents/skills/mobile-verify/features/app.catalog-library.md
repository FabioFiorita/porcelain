---
screen: /component-library
selectors:
  - "Component library"
  - "Explore Text"
tests: []
api: []
---

# app.catalog-library

Development-only component catalog. Settings hides its entry point in release builds, and Expo Router protects all catalog routes with `__DEV__`.

1. On iPad select Settings → Development. Expect a component selector and Text samples immediately; there is no intermediate Component library link. On a phone press Component library under Development to open its directory.
2. On iPad select Explore Badge, then Explore Button. Expect the chosen preview to replace the detail without a navigation push; the selector remains available. In a narrow pane the selector stacks above the preview.
3. On a phone press Explore Text to open its samples, then use native Back to return to the directory and Settings.
4. On iPad select another Settings category to leave the explorer. The app sidebar control remains beside Settings.

Drive entry, Button interaction, file context actions and return navigation with mobile-verify. Disable the development guard on a live development run to verify that the Settings entry disappears, an active catalog route is removed, and direct catalog links return to Settings; restore `__DEV__` afterward.
