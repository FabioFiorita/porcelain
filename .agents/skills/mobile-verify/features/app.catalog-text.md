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

- Phone: Settings → Component library → Explore Text.
- iPad: Settings → Development → Explore Text.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Inspect heading, subheading, body, UI, caption, small and code; default/muted/destructive/card tones and medium/semibold weights.
2. Scroll to Wrapping and selection; long-press the paragraph: native selection actions appear. Repeat at larger accessibility text size and check wrapping.
3. Phone Back returns to Component library then Settings; iPad component/category selection leaves the inline sample.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Development-only. Native selection needs a live gesture; reading the samples does not prove selection.
