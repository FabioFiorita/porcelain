---
screen: /appearance
selectors:
  - "Appearance"
  - "Theme"
  - "theme-system"
  - "theme-light"
  - "theme-dark"
  - "Long lines"
  - "lines-wrap"
  - "lines-scroll"
  - "Markdown opens as"
  - "markdown-reader"
  - "markdown-source"
  - "HTML opens as"
  - "html-preview"
  - "html-source"
  - "Reading saved preferences…"
  - "Read saved preferences again"
tests:
  - packages/client/src/features/preferences/store.spec.ts
api: []
---

# preferences.appearance

## What it is

Appearance stores this app's Theme, Long lines, Markdown default and HTML default in SQLite. The defaults remain System, Wrap, Reader and Preview. Theme applies to Porcelain content and native navigation. The public usePreferences API exposes the content preferences for destination owners to consume; their integration and proof belong to each destination.

## How a user reaches it

- Settings → Appearance; the native Back button returns to Settings.
- The deep link porcelain.dev://appearance.

## Driving it

1. Open Settings → Appearance. Expect Theme, Code and Documents; the selected choices announce that they are selected.
2. Choose Dark, then Light. Inspect both Porcelain content and native navigation. Choose System to follow the device's appearance.
3. Choose Scroll, Markdown Source and HTML Source. Cold-launch, reopen Appearance, and expect every selected choice to persist. Read porcelain-preferences.db independently from the owned simulator's app data.
4. Return through the native Back button. Expect Settings, its environment state and Add environment. Leave through the native tabs and return.
5. Corrupt only this disposable app's preference record, then cold-launch. Expect the read error and disabled controls. Repair its stored record and select Read saved preferences again; expect the saved values and enabled controls.

## What proves it works

- preferences.spec.ts checks defaults, explicit saved values and rejection of malformed or unsupported persisted values. It does not prove native rendering or persistence.
- Native screenshots, interactive snapshots and SQLite readback from mobile-verify prove the iPhone journey when recorded.

## Gotchas

- A refused read preserves the saved record; it never writes defaults over it.
- A refused write keeps the last successful preferences in use and shows an error.
- Preference consumption in each destination requires that destination's native proof. This Settings map alone does not prove Files, History or Review.
- iPad and Android remain unproved in this Settings pass.
