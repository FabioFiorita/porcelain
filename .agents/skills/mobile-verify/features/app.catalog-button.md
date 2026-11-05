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

Development Button samples show the native button variants, sizes and icon buttons with enabled, disabled and pending interactions.

## How to get to it (user POV)

- Settings gear → Development → Component library → Explore Button.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Inspect Filled (brand pill), Tonal (neutral fill), Plain (brand text), Destructive (red-tinted pill, for a confirm that is the only action) and Destructive plain (red text, beside other actions) variants, then Regular/Small sizes and the plain, tonal and filled icon buttons. Check pill corners with no border, 16pt semibold Regular labels on a 44pt surface and 14pt medium Small labels on a 32pt surface, centered inside at least a 44pt (iOS) or 48dp (Android) target; plain icon buttons draw only the glyph. Press near the top/bottom edge of Small to confirm the full target works. Repeat in light/dark on a phone and a tablet in landscape and portrait. Changes to iOS-native controls also need iPhone/iPad proof. Press an enabled sample: Actions increases once.
2. Tap Disabled: Actions stays unchanged. Start pending demo increments Actions once; Working… and spinner appear; another tap does not increase Actions.
3. Finish pending demo restores the enabled action. Reset actions returns zero.
4. Native Back returns through Component library to Settings.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Development-only. Compare the counter before/after each press; a visible spinner alone does not prove duplicate actions are blocked.
