# Porcelain mobile client

Applies under `apps/mobile/`. Read the **`mobile` skill** for the fingerprint-gated build/deliver
loop and runtime traps. This file is platform law that must stay true without loading it.

## Non-negotiable

- **iOS-only** Expo SDK 57, Expo Router, and the EAS development client. No Android branches, no
  Expo Go, and no second native UI architecture.
- Mobile UI is **NativeWind v5, Tailwind CSS v4, react-native-css, and React Native Reusables**.
  Use the CSS-first setup in `metro.config.js`, `postcss.config.mjs`, and `src/global.css`; do not
  reintroduce SwiftUI Hosts, the row canvas, DOM bridges, or custom native UI modules.
- Reusable primitives live in `src/components/ui/` and are copied from the React Native Reusables
  registry with its CLI. Compose them with `className` and `cn`; keep semantic tokens aligned with
  the web shadcn vocabulary in `src/global.css`.
- The v5 setup does not use the NativeWind v4 Babel preset or a `tailwind.config.js`. Keep
  `components.json` for Reusables CLI metadata and make CSS imports the source of truth.
- **`src/lib/daemon/` is the only daemon seam.** Procedures are hand-declared and zod-parsed; never
  import the desktop daemon's `AppRouter`. Keep the existing React Query, zustand, and app-event
  invalidation seams — no second transport or mobile-only protocol.
- Mobile is a **separate native client** of the same daemon, not a renderer port. UI code may share
  design vocabulary with web, but it must use React Native primitives and remain free of desktop DOM
  and shell state.
- Treat every **iPad** presentation claim as unproven until runtime evidence from an iPad backs it.

## Fingerprint first

Ask whether the native fingerprint moved (`eas fingerprint:compare`) before building or delivering.

| Fingerprint | Simulator | Phone |
|-------------|-----------|-------|
| Unchanged | Metro Fast Refresh | `eas update` (free) |
| Moved | Local Mac build (`--local`) or EAS build | EAS workflow (spends a monthly build) |

Prefer **local Mac builds** for simulator-native changes when a Mac is available — cloud builds burn
the monthly quota. Details: `mobile` skill → `reference/loop.md`.

## Normal development

```bash
pnpm --dir apps/mobile start
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile exec expo export --platform ios
pnpm verify          # from repo root, before any commit
```

Pure UI and CSS changes should use Metro Fast Refresh. Check the fingerprint before building or
delivering when dependencies, Expo config, or native runtime requirements change.

Dev daemon on **43118** (worktrees **43200–43999**), never production **43117**.

Host-specific simulator access (SSH to Mac, serve-sim, Metro LAN, local install) lives in the
ignored `apps/mobile/AGENTS.local.md` — load it only for runtime or evidence work.
