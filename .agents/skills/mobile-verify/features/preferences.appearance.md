---
screen: /general
selectors:
  - "General"
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
  - packages/client/src/features/preferences/store/saved-preferences.spec.ts
api: []
---

# preferences.appearance

General saves Theme, Long lines and Markdown/HTML defaults for this app across cold launches.

## Sub-features

- `preferences.appearance` — Theme, long lines, document defaults and persistence.

## How to get to it (user POV)

- Settings → General; on iPad its controls are visible immediately. On a phone, the native Back button returns to Settings.
- The deep link porcelain.dev://general.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open General. Expect Theme, Code and Documents, with selected choices announced. On iPad toggle sidebar: controls stay bounded.
2. Select Dark, Light, then System; inspect content and native navigation. Choose Scroll, Markdown Source and HTML Source. Cold-launch/reopen: choices persist; independently read the owned app's porcelain-preferences.db.
3. Back on phone or Computers on iPad preserves paired state/Add computer. Leave through tabs/sidebar and return.
4. Corrupt one field of the disposable preference record, cold-launch: only that field resets to default; other choices stay. Exercise refused read/write: old record remains, choices disable, and Read saved preferences again recovers.

Automated coverage: `store.spec.ts`, `saved-preferences.spec.ts`.

## Gotchas

- A failed read must not write defaults over saved data; a failed write keeps the last successful choices.
- Destination-specific consumption needs Files/History/Review proof. Diff layout/Spec files are absent; archive switches are under Reviews & Git.
