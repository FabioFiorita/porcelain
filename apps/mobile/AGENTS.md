# Porcelain mobile client

Applies under `apps/mobile/`. Read the **`mobile` skill** for the fingerprint-gated build/deliver
loop and runtime traps. This file is platform law that must stay true without loading it.

## Non-negotiable

- **iOS and Android** Expo SDK 57, Expo Router, and the EAS development client. Android is a
  development and validation target today; keep the door open for a later store release. No Expo
  Go and no second native UI architecture.
- Mobile UI is **NativeWind v5, Tailwind CSS v4, react-native-css, and React Native Reusables**.
  Use the CSS-first setup in `metro.config.js`, `postcss.config.mjs`, and `src/global.css`; do not
  reintroduce SwiftUI Hosts, DOM bridges, or custom native UI modules. The sole exception is
  `modules/porcelain-terminal`: its Ghostty-backed terminal canvas may render terminal cells, but
  it is not an app-UI primitive and must not become a second native screen architecture.
- A **WebView renders user content, never app UI.** The ban above is on building screens out of a
  web page; showing a document that has no native form — an HTML file from the repo, or markdown
  rendered from it — is what `react-native-webview` is here for. Such a document is untrusted: no
  scripting, no network (`default-src 'none'` in the document itself), every navigation refused,
  and web links handed to the system browser. `features/files/preview-view.tsx` is the only host;
  route a new preview through it rather than mounting a second WebView with its own rules.
- Primitives are composed with `className` and `cn`, and semantic tokens stay aligned with the web
  shadcn vocabulary. The shared token source is `@porcelain/ui/tokens.css`; `src/global.css` is the
  NativeWind entrypoint and carries the mobile-only overrides — fonts, `--spacing`, and the two
  smallest type rungs, all pinned to points because the native runtime rem is 14.
- `src/components/ui/` is **not** the vocabulary. It holds the handful of React Native Reusables
  files the app actually adopted — button, text, input, textarea, badge, separator, collapsible,
  and modal-backdrop. `tabs` left with settings' switcher: `SegmentedControl` is the one
  single-select shape. The rest of the registry was deleted for having no importer; do not re-add
  a file from the Reusables CLI unless a screen is using it in the same change.
- The v5 setup does not use the NativeWind v4 Babel preset or a `tailwind.config.js`. Keep
  `components.json` for Reusables CLI metadata and make CSS imports the source of truth.
- **`src/lib/daemon/` is the only daemon seam.** Procedures are hand-declared and zod-parsed; never
  import the desktop daemon's `AppRouter`. Keep the existing React Query, zustand, and app-event
  invalidation seams — no second transport or mobile-only protocol.
- Mobile is a **separate native client** of the same daemon, not a renderer port. UI code may share
  design vocabulary with web, but it must use React Native primitives and remain free of desktop DOM
  and shell state.
- Keep the app UI in one shared React Native path. Platform-specific code is limited to OS-required
  configuration or native primitives (for example, iOS SplitView versus Android system back
  behavior); do not fork product screens or restore the removed SwiftUI / `@expo/ui` architecture.
- **Testability is part of the UI contract.** Every new or materially changed actionable control
  must expose a stable React Native `testID` (prefer `porcelain-<surface>-<target>`) plus a meaningful
  `accessibilityRole` and `accessibilityLabel`. Add IDs to route roots, primary navigation, fields,
  submit/dismiss actions, row actions, modal roots, and stable loading/error/empty states; do not
  use translated copy, array indexes, timestamps, random values, or coordinates as IDs. If a native
  primitive cannot accept `testID`, keep its accessible label stable and document the exception in
  the change. The Android loop resolves these IDs through the live `uiautomator` tree.
- Treat every **iPad** presentation claim as unproven until runtime evidence from an iPad backs it.

## The vocabulary

Screens are assembled from these, not from raw `View`s with their own spacing. A surface that
hand-writes one of them is a surface that drifts from the other nine.

| Reach for | For |
|---|---|
| `components/panel-chrome.tsx` | `ScreenHeader` (every pushed screen), `IconAction`, `PanelLabel`, `EmptyNote`, `ErrorNote`, `StatusNote`, `ActionSheet`, `ConfirmDialog` |
| `components/shell-modal.tsx` | The **only** modal primitive — `ShellModal`, `ShellModalScroll`, `useShellModalSize`. Never stack two; `ui/dialog` was deleted, not misplaced |
| `components/chrome-glyph.tsx` | Every icon. Never Lucide — Fabric paints red "U" placeholders for a font that has not landed |
| `components/segmented-control.tsx` | Every single-select switcher. Not `ToggleGroup` |
| `components/surface-scroll.tsx` | `SurfaceScroll` / `SurfaceList`: they read the bottom chrome themselves, so no inset travels as a prop |
| `components/surface-layout.ts` | `SURFACE_GUTTER`, `SURFACE_ROW`, `PANEL_CARD`, and the toolbar/note bands |

Headers: a phone tab root wears `PhoneHeader` (large title, workspace chips, the companion bolt);
anything pushed on top of one wears `ScreenHeader`. Loading is a line of text, never a spinner.
Empty is `EmptyNote`. A row's actions are long-press → `ActionSheet` — no swipe gestures.

`surface-layout.test.ts` and `scripts/lint-mobile-nativewind.mjs` hold the spacing, type, and card
decisions; read their comments before arguing with a failure.

No file under `src/` may pass **450 lines** (`scripts/lint-mobile-file-size.mjs`). Length is a
proxy for a file doing several jobs — which is also why the long ones had no tests. Split into a
`use-<feature>.ts`, a pure module beside its `.test.ts`, and the markup. The script's allowlist is
a record of Phase 3b debt and may only shrink; adding an entry is never the fix.

## The data idiom

- A feature reaches the daemon **only** through its own `use-<feature>.ts`. Components import
  procedure *types* freely and `lib/daemon/queries` never — Biome enforces it at error level with
  no exemptions left. Do not add one back; split the file instead.
- Mutations are **invalidate-only**: `useDaemonMutation` with a named `*_INVALIDATIONS` constant,
  and `await mutateAsync`. No optimistic cache writes — the daemon moves real files, and a client
  that painted the result first would show work that never happened.
- The one sanctioned exception is `features/terminal/terminal-store.ts`: closing a session writes a
  local tombstone so a poll in flight cannot resurrect the row. That is session state, not repo
  state, and it is the only place the pattern belongs.
- Shared poll intervals live in `lib/daemon/poll.ts`. `LIVE_POLL_MS` is shared rather than
  per-feature because React Query takes the **shortest** interval among a key's observers — two
  surfaces on one cache entry with different rates silently get the faster one.
- `features/settings/preferences-store` is the shared user-config layer: any feature may import it
  directly, and nine already do. It is the exception to features keeping to themselves.

A new tab is five files: `<feature>-store.ts`, `<feature>-list.tsx`, `<feature>-viewer.tsx`,
`<feature>-phone-screen.tsx`, `use-<feature>.ts`. Add a `<feature>-companion.tsx` when the tablet
inspector column has something to say.

## Fingerprint first

Ask whether the native fingerprint moved (`eas fingerprint:compare`) before building or delivering.

| Fingerprint | iOS simulator / Android emulator | Phone |
|-------------|-------------------------------|-------|
| Unchanged | Metro Fast Refresh | `eas update` (free) |
| Moved | Local native build on the matching host or EAS build | EAS workflow (iOS) or local Android build |

Prefer **local Mac builds** for simulator-native changes when a Mac is available — cloud builds burn
the monthly quota. Details: `mobile` skill → `reference/loop.md`.

## Normal development

```bash
pnpm --dir apps/mobile start
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile exec expo export --platform ios
pnpm --dir apps/mobile android:build
pnpm verify          # from repo root, before any commit
```

Pure UI and CSS changes should use Metro Fast Refresh. Check the fingerprint before building or
delivering when dependencies, Expo config, or native runtime requirements change.

Daemon ports and homes: root `AGENTS.md` → "Prod vs dev" is canonical — dev only, never production.

Host-specific simulator access (SSH to Mac, serve-sim, Metro LAN, local install) lives in the
ignored `apps/mobile/AGENTS.local.md` — load it only for runtime or evidence work.
