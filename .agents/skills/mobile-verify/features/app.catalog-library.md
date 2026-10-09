---
screen: /component-library
selectors:
  - "Component library"
  - "Explore Text"
tests:
  - apps/mobile/spec/e2e/component-library.e2e.ts
api: []
---

# app.catalog-library

Development-only component catalog. Settings hides its entry point in release builds, and Expo Router protects all catalog routes with `__DEV__`.

1. Open Settings and press Component library under Development.
2. Expect the directory of implemented primitives, initially Text.
3. Press Explore Text to open its samples.
4. Use the native back button to return to the directory, then Settings.

The catalog spec covers entry, Button interaction, file context actions and return navigation. Disable the development guard on a live development run to verify that the Settings entry disappears, an active catalog route is removed, and direct catalog links return to Settings; restore `__DEV__` afterward.
