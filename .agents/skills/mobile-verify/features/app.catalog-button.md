---
screen: /component-button
selectors:
  - "Explore Button"
  - "Variants"
  - "Disabled and pending"
  - "Start pending demo"
  - "Finish pending demo"
tests:
  - apps/mobile/spec/e2e/component-library.e2e.ts
api: []
---

# app.catalog-button

Development-only Button samples reached through Settings, Component library, Explore Button. All catalog routes are protected by `__DEV__` and unavailable in release builds.

1. Inspect default, secondary, outline, ghost, destructive and link variants.
2. Press an enabled sample and confirm Actions increases once.
3. Scroll to sizes, then disabled and pending samples.
4. Tap Disabled. Confirm Actions stays unchanged.
5. Press Start pending demo. Expect Working… with a spinner; confirm another tap does not increase Actions.
6. Finish pending demo restores the enabled action. Reset actions returns the count to zero.
7. Use the native back button to return to Component library, then Settings.

The catalog spec checks the enabled Button action. Remaining variants and states are verified manually on the live development simulator.
