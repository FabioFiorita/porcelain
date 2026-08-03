---
name: mobile
metadata:
  internal: true
description: Porcelain's native iOS client — the platform decisions, the fingerprint-gated development and delivery loop, and the traps a fresh read won't recover. Read before changing anything under apps/mobile, or before building, installing, or delivering the app.
---

# Native mobile (`apps/mobile`)

A separate native client of the same daemon, not a port of the renderer. It shares protocols and
domain contracts, never DOM components, Tailwind, or tab-store routing.

## Platform decisions

- **iOS-only** (`"platforms": ["ios"]`). Android would cost a `Platform.OS` branch and a raster twin
  per SF Symbol, a second runtime loop, and a lowest-common-denominator ceiling on `@expo/ui`, for
  no audience. So: no `Platform.OS` branches, no `.ios.tsx`/`.android.tsx` pairs, no PNG twins.
- **Expo rather than raw Xcode even at one platform:** one daemon router and no second API, OTA
  fixes without App Store review, builds that don't need a Mac per change.
- **`@expo/ui/swift-ui` only — never the universal `@expo/ui` root** (`Host` included; SDK 57 exports
  its own from the subpath). Lint-enforced by `scripts/lint-escapes.mjs`. 51 components against the
  universal layer's 19, and the gap already cost product decisions — universal `Text` takes only a
  string, which is what blocked syntax highlighting in the diff reader. Cost accepted: verbose trees,
  no web target. The `@expo/ui` **package** stays a dependency; this is the import path, not the dep.
- **Dev-client builds, never Expo Go** — `@expo/ui`, secure-store, webview and sqlite are all absent
  from the Go binary.
- **`runtimeVersion` policy is `fingerprint`**, so an OTA can never land on an incompatible binary.
  It is also why the fingerprint decides every loop below.
- **`ios.supportsTablet: true` is load-bearing.** The iPad presentation is a root `SplitView`, so the
  binary must include the iPad device family. It is a native flag: changing it moves the fingerprint.
- **Cleartext HTTP is allowed APP-WIDE, deliberately** (`NSAllowsArbitraryLoads`): daemons are plain
  `http` on bare LAN/tailnet IPs, and `NSAllowsLocalNetworking` does not cover `100.64/10`, so it is
  app-wide or nothing. **Not** licence to reach a *public* endpoint over plain HTTP — that path is
  Funnel (HTTPS). Don't "tighten" it without first solving tailnet-IP HTTP, or the app silently stops
  reaching the machines it exists to reach. App Store review's answer is device pairing.

**TRAP:** a SwiftUI `Button` tints its *entire label*, so a `Button`-wrapped settings row renders as
blue link text. Every tappable row needs `buttonStyle('plain')`, and `tsc` cannot see it.

## The one question: did the fingerprint move?

Every loop below forks on it. JS, TS, styling and assets do not move it; a native dependency, an
`app.config.ts` field, an SDK bump or a new native module does. Ask the tool, don't guess:

```bash
eas fingerprint:compare      # current project against a build or update
```

| | Fingerprint **unchanged** | Fingerprint **moved** |
|---|---|---|
| **See it on the simulator** | Metro Fast Refresh. No SSH, no install, no cost | Build on the Mac (`--local`, free), install there |
| **Get it to the phone** | `eas update` from Linux — no workflow, no trigger | Dispatch `preview.yml`; spends one of 15 monthly iOS builds |

The bottom-left cell is the cheap one and covers most sessions. The bottom-right is the only cell
that spends a build. Mechanics, costs and failure modes: [`reference/loop.md`](reference/loop.md).

## Rule-5 exceptions, exhaustive

1. `react-native-webview` in exactly two places — sandboxed loop-evidence HTML (JS off) and the
   Terminal's xterm.js bundle, a committed bundle of the root `@xterm/*` deps with **zero new runtime
   deps**, which never opens a socket or sees the token. A WebView for ordinary UI stays banned.
2. Rotation is unlocked, so **every screen must tolerate rotation**.
3. One custom Expo native module: a **generic row engine** (diff now, terminal later). Its Swift
   surface stays generic — rows, theme and tokens as data, feature logic in JS.

## Reference

| File | When to read |
|---|---|
| [`reference/loop.md`](reference/loop.md) | Running the app, building, installing on a simulator, or delivering an update or a TestFlight build |
| [`reference/client.md`](reference/client.md) | Changing screens, the tab shell, the daemon seam, or where a file goes |

T3 Code's mobile app is plain React Native with one `swift-ui` file — not a reference.
