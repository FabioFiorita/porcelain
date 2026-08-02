# Native mobile (`apps/mobile`)

A separate native client of the same daemon, not a port of the renderer.

- **iOS-only** (`"platforms": ["ios"]`). Android cost a `Platform.OS` branch and a raster twin per
  SF Symbol, a second runtime loop, and a lowest-common-denominator ceiling on `@expo/ui`, for no
  audience. So: no `Platform.OS` branches, no `.ios.tsx`/`.android.tsx` pairs, no PNG twins.
- **Expo rather than raw Xcode even at one platform:** one daemon router and no second API,
  OTA fixes without App Store review, builds that don't need a Mac per change.
- **`@expo/ui/swift-ui` only — never the universal `@expo/ui` root** (`Host` included; SDK 57
  exports its own from the subpath, so the vendored `expo-ui` skill's "Host from the root" doesn't
  apply). Lint-enforced. 51 components vs the universal layer's 19, and the gap already cost product
  decisions (universal `Text` takes only strings). No modifier gap existed, so the win is components
  and one idiom, not reach.
  Cost accepted: verbose trees, no web target. The `@expo/ui` **package** stays a dependency.
- **TRAP:** a SwiftUI `Button` tints its *entire label*, so a `Button`-wrapped settings row renders
  as blue link text — every tappable row needs `buttonStyle('plain')`. `tsc` can't see it.
- **Dev-client builds, not Expo Go** (`@expo/ui`, secure-store, webview, sqlite are all absent from
  the Go binary). `runtimeVersion` policy is **fingerprint**, so an OTA never lands on an
  incompatible binary.
- **Delivery is fingerprint-decided on PRs *and* main** (`preview.yml`) — both are real ship paths,
  so both must leave TestFlight running that code. **`wait_for_in_progress` on `get-build` is what
  stops a merged PR paying twice** (it matches the fingerprint hash, not the branch). Force-build
  escape is EAS's built-in `eas-build-ios:preview` label, not a job. `production.yml` has **no push
  or tag trigger** and submission off by default — the release path is decided without being armed.
- **`ios.supportsTablet: true` is load-bearing.** The iPad presentation is a root `SplitView`, so
  the binary must include the iPad device family. Native flag: changing it moves the fingerprint.
- **iPhone and iPad have two presentations over one route table.** iPhone keeps `NativeTabs`; iPad
  uses the root `SplitView` with the same destinations and Files list/detail columns. Do not add an
  iPad-only route table or selection store. **Treat every iPad claim here as unproven until a
  screenshot backs it.** `SplitView` is structurally blocked inside another navigator, so the fork
  belongs only in the root layout once the real Files feature is ready.
- **Five native tabs — Files · Changes · Review · Board · Terminal**, and five is the ceiling: a
  sixth collapses iOS into "More". So History stays pushed inside Changes; Search is a search bar
  on Files; Settings is a formSheet. Environments are **LAN + Tailscale only
  — no relay tier, deliberately**: a relay is a recurring bill, Funnel is already the public path.
- **Feature slices** (`src/features/<feature>/` owns screens and logic; `src/app` is a thin route
  table) so parallel worktrees don't collide in a shared component tree.
- **Transport:** untyped `@trpc/client` + react-query behind `src/lib/daemon/`; responses are
  **zod-parsed** against hand-declared descriptors. Never import the daemon's `AppRouter` — it drags
  45 modules through `tsc`; WS schemas come from `@porcelain/contracts`. Credential in
  `expo-secure-store`; **pasted link only, no QR**.
- **Rule-5 exceptions, exhaustive.** (1) `react-native-webview` in exactly two places: sandboxed
  loop-evidence HTML (JS off) and the Terminal's xterm.js bundle — the same emulator as desktop, a
  committed bundle of the root `@xterm/*` deps (**zero new runtime deps**) that never opens a
  socket or sees the token; the RN bridge carries only terminal bytes, dimensions, focus, and
  link notifications. A WebView for ordinary UI stays banned. (2) Rotation is unlocked, so
  **every screen must tolerate rotation**. (3) One custom Expo native module: a **generic row
  engine** (diff now, terminal later). Its Swift surface stays generic: rows/theme/tokens as data,
  feature logic in JS.
- **Cleartext HTTP is allowed APP-WIDE, deliberately** (`NSAllowsArbitraryLoads`): daemons are plain
  `http` on bare LAN/tailnet IPs and `NSAllowsLocalNetworking` doesn't cover `100.64/10`, so it's
  app-wide or nothing. **Not** license to reach a *public* endpoint over plain HTTP — that path is
  Funnel (HTTPS). Don't "tighten" it without first solving tailnet-IP HTTP, or the app silently
  stops reaching the machines it exists to reach. App Store review's answer: device pairing.
- **EAS Observe is launch metrics only** — the `expo-router` integration and `Observe.logEvent` are
  **deliberately unconfigured**. Traps: only the **first**
  `markInteractive` per session counts, so a marker above loaded content silently degrades TTI into
  a second TTR; `expo-observe` is native, so adding it moved the fingerprint; debug builds never
  dispatch unless `dispatchInDebug: true`.

T3 Code's mobile app is plain React Native with one `swift-ui` file — not a reference. The native
app shares protocols and domain contracts, never DOM components, Tailwind, or tab-store routing.
