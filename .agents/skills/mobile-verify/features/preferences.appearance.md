---
screen: /general
selectors:
  - 'General'
  - 'Theme'
  - 'theme-system'
  - 'theme-light'
  - 'theme-dark'
  - 'Long lines'
  - 'lines-wrap'
  - 'lines-scroll'
  - 'Documents open as'
  - 'documents-rendered'
  - 'documents-source'
  - 'Reading saved preferences…'
  - 'Read saved preferences again'
tests:
  - packages/client/src/features/preferences/store.spec.ts
  - packages/client/src/features/preferences/store/saved-preferences.spec.ts
api: []
---

# preferences.appearance

General saves Theme, Long lines and one document default for Markdown and HTML for this app across cold launches.

## How to get to it (user POV)

- Settings → General; on iPad its controls are visible immediately. On a phone, the native Back button returns to Settings.
- The deep link porcelain.dev://general.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open General. Expect Appearance (Theme), Code and Documents, with selected choices announced. Long lines offers Scroll then Wrap; Documents offers Rendered then Source. On iPad, expect Settings. General and its description, with preference choices inline on the right. The footer says These preferences are saved on this device. Phone controls remain below their labels. On iPad toggle sidebar: controls stay bounded.
2. Select Dark, Light, then System; inspect content and native navigation. Choose Scroll and Documents Source. Open Markdown and HTML from Files and expect Source; code files always open as source. Cold-launch/reopen: choices persist; independently read the owned app's porcelain-preferences.db.
3. Back on phone or Computers on iPad preserves paired state/Add computer. Leave through tabs/sidebar and return.
4. Seed a legacy preference record with only Markdown Source, then only HTML Source: both migrate to Documents Source. Select Rendered and cold-launch; it stays Rendered and the saved record contains only documentsDefault.
5. Corrupt one field of the disposable preference record, cold-launch: only that field resets to default; other choices stay. Exercise refused read/write: old record remains, choices disable, and Read saved preferences again recovers.

Automated coverage: `store.spec.ts`, `saved-preferences.spec.ts`.

## Gotchas

- A failed read must not write defaults over saved data; a failed write keeps the last successful choices.
- Destination-specific consumption needs Files/History/Review proof. Diff layout/Spec files are absent; archive switches are under Reviews & Git.
