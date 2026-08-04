# Porcelain mobile client

Applies under `apps/mobile/`. Read the **`mobile` skill** for the fingerprint-gated build/deliver
loop and runtime traps. This file is platform law that must stay true without loading it.

## Non-negotiable

- **iOS-only** Expo SDK 57, Expo Router, EAS development client. No Android branches, no Expo Go,
  no second native architecture.
- **`@expo/ui/swift-ui` + `/modifiers` only.** Never import the universal `@expo/ui` root or `Host`
  (lint-enforced).
- Feature code lives in `src/features/<feature>/`. `src/app/` stays thin re-exports and layouts.
- **`src/lib/daemon/` is the only daemon seam.** Procedures are hand-declared and zod-parsed; never
  import the desktop daemon's `AppRouter`. Same React Query + zustand seams and app-event
  invalidation — no second transport or mobile-only protocol.
- Mobile is a **separate native client** of the same daemon, not a renderer port. No desktop DOM,
  Tailwind, shadcn, or desktop shell state.
- Treat every **iPad** presentation claim as unproven until runtime evidence from an iPad backs it.
- SwiftUI `Button` tints its entire label — tappable rows need `buttonStyle('plain')`.
- **Anything that lists paths renders on the row canvas** — Files, Changes, History, commit detail,
  search — through `components/entry-canvas.tsx` and the one row model in `entry-rows.ts`. A file
  reads the same in the list and in the diff it opens because it is the same surface. SwiftUI
  `List` stays for forms, empty states and notices; a `FlatList` of per-row `Host`s is the shape
  this replaced, not a fallback to reach for.
- **The terminal is xterm in a WebView, themed from `theme/terminal-colors.ts`.** Desktop and web
  render the same `@xterm/xterm`, so the emulator behaves identically on all three surfaces —
  replacing it with a native VT forks terminal behaviour, not just rendering. Chrome colours are
  lint-banned from carrying hex literals because the WebView picks its theme from
  `prefers-color-scheme` and a literal cannot follow it. The **key bar docks above the keyboard**,
  never the top of the screen: every key on it corrects the keystroke you just typed.

## Fingerprint first

Ask whether the native fingerprint moved (`eas fingerprint:compare`) before building or delivering.

| Fingerprint | Simulator | Phone |
|-------------|-----------|--------|
| Unchanged | Metro Fast Refresh | `eas update` (free) |
| Moved | Local Mac build (`--local`) or EAS build | EAS workflow (spends a monthly build) |

Prefer **local Mac builds** for simulator-native changes when a Mac is available — cloud builds burn
the monthly quota. Details: `mobile` skill → `reference/loop.md`.

## Normal development

```bash
pnpm --dir apps/mobile start
pnpm --dir apps/mobile typecheck
pnpm verify          # from repo root, before any commit
```

Dev daemon on **43118** (worktrees **43200–43999**), never production **43117**.

Host-specific simulator access (SSH to Mac, serve-sim, Metro LAN, local install) lives in the
ignored `apps/mobile/AGENTS.local.md` — load it only for runtime or evidence work.
