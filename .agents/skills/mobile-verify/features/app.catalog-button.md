---
screen: /component-button
selectors:
  - 'Explore Button'
  - 'Variants'
  - 'Disabled and pending'
  - 'Start pending demo'
  - 'Finish pending demo'
tests: []
api: []
---

# app.catalog-button

Development Button samples show variants and sizes with enabled, disabled and pending interactions.

## How to get to it (user POV)

- Phone: Settings → Development → Component library → Explore Button.
- iPad: Settings → Development → Explore Button.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Inspect Default, Secondary, Outline, Ghost, Destructive and Link variants, then Regular/Small sizes. Check 12pt medium labels, md corners and compact visible surfaces centered inside at least 44pt targets. Press near the top/bottom edge of Small to confirm the full target works. Repeat in light/dark, on iPad landscape then portrait, iPhone and Android. Press an enabled sample: Actions increases once.
2. Tap Disabled: Actions stays unchanged. Start pending demo increments Actions once; Working… and spinner appear; another tap does not increase Actions.
3. Finish pending demo restores the enabled action. Reset actions returns zero.
4. Phone native Back returns through Component library to Settings. On iPad choose another sample/category to leave.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Development-only. Compare the counter before/after each press; a visible spinner alone does not prove duplicate actions are blocked.
