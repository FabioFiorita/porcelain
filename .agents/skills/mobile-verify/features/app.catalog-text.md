---
screen: /component-text
selectors:
  - "Type scale"
  - "Tones and weights"
  - "Wrapping and selection"
tests:
  - apps/mobile/spec/e2e/component-library.e2e.ts
api: []
---

# app.catalog-text

Development-only Text samples reached through Settings, Component library, Explore Text. All catalog routes are protected by `__DEV__` and unavailable in release builds.

1. Inspect heading, subheading, body, UI, caption, small and code samples.
2. Inspect default, muted, destructive and card tones, plus medium and semibold weights.
3. Scroll to Wrapping and selection. Long press the paragraph and confirm native selection actions appear.
4. Return with the native back button to Component library and then Settings.

The component-library spec opens Explore Text and checks its type scale and tones before returning to the catalog. Native selection and larger accessibility text are also driven on the live development simulator.
