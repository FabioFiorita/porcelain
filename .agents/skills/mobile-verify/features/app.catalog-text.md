---
screen: /component-text
selectors:
  - "Type scale"
  - "Tones and weights"
  - "Wrapping and selection"
tests: []
api: []
---

# app.catalog-text

Development Text samples show type styles, wrapping and native selection.

## How to get to it (user POV)

- Settings gear → Development → Component library → Explore Text.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Inspect large title (28), title (20), headline (16 semibold), body (16), secondary (14), caption (12) and code (Geist Mono 13); interface text uses the system font (SF on iOS, Roboto on Android). Check default/muted/destructive tones and medium/semibold weights.
2. Scroll to Wrapping and selection; long-press the paragraph: native selection actions appear. Repeat at larger accessibility text size and check wrapping.
3. Native Back returns to Component library then Settings.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Development-only. Native selection needs a live gesture; reading the samples does not prove selection.
