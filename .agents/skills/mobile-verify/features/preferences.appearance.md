---
screen: /appearance
selectors:
  - 'Appearance'
  - 'Theme'
  - 'theme-system'
  - 'theme-light'
  - 'theme-dark'
  - 'Long lines'
  - 'lines-wrap'
  - 'lines-scroll'
  - 'Markdown opens as'
  - 'markdown-reader'
  - 'markdown-source'
  - 'HTML opens as'
  - 'html-preview'
  - 'html-source'
  - 'Reading saved preferences…'
  - 'Read saved preferences again'
tests:
  - packages/client/src/features/preferences/store.spec.ts
  - packages/client/src/features/preferences/store/saved-preferences.spec.ts
api: []
---

# preferences.appearance

## What it is

Appearance stores this app's Theme, Long lines, Markdown default and HTML default in SQLite. The defaults remain System, Wrap, Reader and Preview. Theme applies to Porcelain content and native navigation. The public usePreferences API exposes the content preferences for destination owners to consume; their integration and proof belong to each destination.

## How a user reaches it

- Settings → Appearance; on iPad its controls are visible immediately. On a phone, the native Back button returns to Settings.
- The deep link porcelain.dev://appearance.

## Driving it

1. Open Settings. On iPad expect Appearance immediately; on a phone select Theme, code and documents under Appearance. Expect Theme, Code and Documents; the selected choices announce that they are selected. On iPad show and hide the app sidebar and expect every control to stay within the detail area.
2. Choose Dark, then Light. Inspect both Porcelain content and native navigation. Choose System to follow the device's appearance.
3. Choose Scroll, Markdown Source and HTML Source. Cold-launch, reopen Appearance, and expect every selected choice to persist. Read porcelain-preferences.db independently from the owned simulator's app data.
4. On a phone return through the native Back button; on iPad select Environments. Expect the same environment state and Add environment. Leave through the native tabs or iPad sidebar and return.
5. Corrupt one field of this disposable app's preference record, then cold-launch. Expect that field at its default and every other saved choice kept.

## What proves it works

- store.spec.ts checks that a change keeps the other saved choices across a restart, that two quick changes both persist, and that a failed read or save disables changes until the next read. saved-preferences.spec.ts checks defaults, old mobile and web records and per-field repair of malformed values. Neither proves native rendering or SQLite persistence.
- Native screenshots, interactive snapshots and SQLite readback from mobile-verify prove the iPhone journey when recorded.

## Gotchas

- A refused read preserves the saved record; it never writes defaults over it.
- A refused write keeps the last successful preferences in use, shows an error and disables the choices until Read saved preferences again succeeds.
- Preference consumption in each destination requires that destination's native proof. This Settings map alone does not prove Files, History or Review.
- Each platform needs its own native proof; iPhone does not prove iPad or Android.
