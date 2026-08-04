# Porcelain mobile client

Applies under `apps/mobile/`. Read the **`mobile` skill** for the fingerprint-gated build/deliver
loop and runtime traps. This file is platform law that must stay true without loading it.

## Non-negotiable

- **iOS and Android** Expo SDK 57, Expo Router, and the EAS development client. Android is a
  development and validation target today; keep the door open for a later store release. No Expo
  Go and no second native UI architecture.
- Mobile UI is **NativeWind v5, Tailwind CSS v4, react-native-css, and React Native Reusables**.
  Use the CSS-first setup in `metro.config.js`, `postcss.config.mjs`, and `src/global.css`; do not
  reintroduce SwiftUI Hosts, the row canvas, DOM bridges, or custom native UI modules.
- Reusable primitives live in `src/components/ui/` and are copied from the React Native Reusables
  registry with its CLI. Compose them with `className` and `cn`; keep semantic tokens aligned with
  the web shadcn vocabulary. The shared token source is `@porcelain/ui/tokens.css`; keep
  `src/global.css` as the NativeWind entrypoint and add only mobile-specific font/setup overrides
  there.
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

Dev daemon on **43118** (worktrees **43200–43999**), never production **43117**.

Host-specific simulator access (SSH to Mac, serve-sim, Metro LAN, local install) lives in the
ignored `apps/mobile/AGENTS.local.md` — load it only for runtime or evidence work.
