---
name: architecture
metadata:
  internal: true
description: Porcelain's stack, the one client architecture every feature follows, and the decisions and traps the code can't show you. Read before writing or reviewing any code in this repo.
---

# Porcelain architecture

Decisions, deliberate absences, and traps a fresh read won't recover. It does **not** paraphrase
how a feature is wired — open the entry file in **Nomenclature** and read it.

## Stack

| Area | Decision |
|---|---|
| Desktop/browser shell | Electron via electron-vite, React 19, strict TypeScript |
| Desktop/browser UI | shadcn/ui on **Base UI** (`@base-ui/react`, not Radix) + Tailwind v4, preset `b5J4txmSY` (nova/neutral/sky), dark default |
| Typography | Sans/mono split — `main.css` deliberately overrides the preset's `--font-sans` to Geist; mono is codelike content only. **TRAP:** `VirtualRows` hardcodes `font-mono`, so prose rows must override back to `font-sans` |
| Native mobile | Expo SDK 57, **iOS-only**, Expo Router, `@expo/ui/swift-ui` + `/modifiers`. EAS dev-client builds, never Expo Go |
| Client state | zustand, one small store per concern. No other state library |
| Git backend | Shell out to the `git` CLI, parse porcelain output. No git libraries |
| Per-repo config | App-side JSON under `userData`, keyed by repo path. Never write into work repos |
| Package manager | pnpm |
| Lint/format | Biome (no ESLint/Prettier); unused imports/vars are **errors**. Plus knip and four custom gates |
| Tests | Vitest (`src/**/*.test.{ts,tsx}`) + Playwright (`e2e/*.spec.ts`) |

Custom gates cover rules Biome can't express. Scope is deliberate; all four skip comment lines,
because the bans are *documented* next to the code they guard.

| Gate | Enforces | Scope |
|---|---|---|
| `lint-escapes.mjs` | `as unknown as`, `void` on promises, mobile universal-`@expo/ui` imports | **all clients incl. `apps/mobile`** — hard rules 6/7 are about the language |
| `lint-control-recipes.mjs` | compact control classes come from `lib/controls.ts` | renderer |
| `lint-shadcn-heuristics.mjs` | hand-rolled renderer primitives | renderer |
| `lint-audit.mjs` | `isSafeExternalUrl`, `GIT_OPTIONAL_LOCKS`, hook env scrub | daemon/main |

`knip` covers unused files/deps/binaries, not unused exports — many schemas and helpers are
deliberately public for tests and the CLI island.

## Native mobile (`apps/mobile`)

A separate native client of the same daemon, not a port of the renderer.

- **iOS-only** (`"platforms": ["ios"]`). Android cost a `Platform.OS` branch and a raster twin per
  SF Symbol, a second runtime loop, and a lowest-common-denominator ceiling on `@expo/ui`, for no
  audience. So: no `Platform.OS` branches, no `.ios.tsx`/`.android.tsx` pairs, no PNG twins.
- **Expo rather than raw Xcode even at one platform:** tRPC types shared off the daemon router (no
  second API client), OTA fixes without App Store review, builds that don't need a Mac per change.
- **`@expo/ui/swift-ui` only — never the universal `@expo/ui` root** (`Host` included; SDK 57
  exports its own from the subpath, so the vendored `expo-ui` skill's "Host from the root" doesn't
  apply). Lint-enforced. 51 components vs the universal layer's 19, and the gap already cost
  product decisions — universal `Text` is `children?: string`, which is why the diff reader has no
  syntax highlighting. No modifier gap existed, so the win is components and one idiom, not reach.
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
- **`ios.supportsTablet: true` is load-bearing.** Without it iPad runs in compatibility mode —
  fixed portrait, no rotation, never a regular size class, so `sidebarAdaptable` has nothing to
  promote. Native flag: changing it moves the fingerprint.
- **iPad is the same four tabs adapted, not a second shell.** `sidebarAdaptable` on iOS 18+ gives a
  top tab bar with a sidebar toggle, not an unconditional sidebar. **Treat every iPad claim here as
  unproven until a screenshot backs it** — these were written from docs and shipped unverified once.
  Multi-column Files is structurally blocked: `SplitView` throws inside another navigator, so it can
  only be the root layout; that fork is deferred to the real Files feature.
- **Four native tabs — Files · Changes · Review · Terminal.** History is pushed inside Changes;
  Board inside Review, because a card *starts* a review and as peers that flow crosses the tab bar;
  Search is a search bar on Files; Settings is a formSheet. Environments are **LAN + Tailscale only
  — no relay tier, deliberately**: a relay is a recurring bill, Funnel is already the public path.
- **Feature slices** (`src/features/<feature>/` owns screens and logic; `src/app` is a thin route
  table) so parallel worktrees don't collide in a shared component tree.
- **Transport intent (not built):** `@trpc/client` + react-query on the same router, credential in
  `expo-secure-store`, paired by a **pasted link only — no QR, deliberate** (camera dependency for
  one screen). No second protocol, no mobile-only API.
- **Rule-5 exceptions, exhaustive.** (1) `react-native-webview` in exactly two places: sandboxed
  loop-evidence HTML (JS off) and the Terminal's xterm.js bundle — the same emulator as desktop, so
  agent TUIs render identically instead of smearing through hand-rolled ANSI; it's a committed
  generated bundle from the root `@xterm/*` deps (**zero new runtime deps**) and never opens a
  socket or sees the token. A WebView for ordinary UI stays banned. (2) Rotation is unlocked, so
  **every screen must tolerate rotation**. `Alert.alert` is no longer an exception.
- **Cleartext HTTP is allowed APP-WIDE, deliberately** (`NSAllowsArbitraryLoads`): daemons are plain
  `http` on bare LAN/tailnet IPs and `NSAllowsLocalNetworking` doesn't cover `100.64/10`, so it's
  app-wide or nothing. **Not** license to reach a *public* endpoint over plain HTTP — that path is
  Funnel (HTTPS). Don't "tighten" it without first solving tailnet-IP HTTP, or the app silently
  stops reaching the machines it exists to reach. App Store review's answer: device pairing.
- **EAS Observe is launch metrics only** — the `expo-router` integration and `Observe.logEvent` are
  **deliberately unconfigured** because their dashboards start at the Production plan, so enabling
  them pays event volume for data the account cannot open. Traps: only the **first**
  `markInteractive` per session counts, so a marker above loaded content silently degrades TTI into
  a second TTR; `expo-observe` is native, so adding it moved the fingerprint; debug builds never
  dispatch unless `dispatchInDebug: true`.

T3 Code's mobile app is plain React Native with one `swift-ui` file — not a reference. The native
app shares protocols and domain contracts, never DOM components, Tailwind, or tab-store routing.

## The one architecture

```
daemon (src/backend/api.ts procedures + pure logic in own modules; Electron-free, HTTP/WS on 127.0.0.1)
  → lib/trpc.ts (appRouter client) + lib/daemon.ts (the WS session) — imports restricted to hooks/ and stores/
    → hooks/use-<domain>.ts (queries, mutations, invalidation)
      → components/<area>/*.tsx (UI only; consume hooks + stores)
stores/ (zustand: client-only state — tabs, repo, preferences, selection)

shell (src/main/shell-api.ts) — a SEPARATE thin surface: the few Electron-native procedures
  (dialogs, windows, updater) over tRPC-over-IPC, its own client (shellTrpc)
```

### The daemon — client/server always, even fully local

The renderer never touches the backend in-process. Deliberate: local and remote are ONE code path,
so they can't drift, and pointing the client at a remote daemon needed no new transport.

- **Spawn/restart.** The daemon prints ONE stdout line `{"port": N}`. A crash restarts with capped
  backoff (give up after 3 rapid failures) and pushes the new url to **local-bound windows only**. A
  utility child has no stdin, so `PORCELAIN_NO_STDIN_WATCHDOG=1` is set and Electron owns its
  lifetime; standalone daemons under plain `node` keep the parent-death watchdog so they never
  orphan. `utilityProcess.fork` is required — an `audit` invariant.
- **Private listeners reconcile, not bind-once** — tailnet/LAN addresses appear *after* boot, so
  enabled listeners re-scan every 5s and diff sockets. Bind/Funnel rules: `audit`.
- **The daemon serves the renderer to a plain browser.** Electron and browser use the SAME dist,
  split only at `lib/platform.ts`. Fingerprinted assets are immutable for a year; the host-rewritten
  shell stays `no-cache` so a release is discovered immediately.
- **The standalone `porcelain-daemon` package** is plain Node with renderer + agent CLI + host CLI;
  share control is CLI-first for headless hosts. **Deliberately no SSH launch** — the host process is
  started manually or supervised (`--no-watchdog`). Every `serve` refreshes the bundled agent CLI.
- **Each WINDOW binds to a daemon**, from a list persisted **shell-side** (the shell owns it, so it
  cannot live in the daemon's own config). Bindings key off `webContents.id`, so one window can be
  local while another is remote, and the local child keeps running underneath for instant
  switch-back. Tokens never cross to the renderer. **A switch is a main-process
  `webContents.reload()` landing on welcome** — a renderer `location.reload()` after invalidate
  raced and left shell chrome on one daemon while appRouter talked to the other; welcome is forced
  because restoring a path from the previous disk is wrong.
- **The one AUTOMATIC settings seed is worktree-local, never overwrites, and fails silently.**
  Companion data is keyed by absolute path, so a linked worktree of a configured project would open
  blank; seeding runs only when the target has no settings at all, and a create/open must never fail
  because a channel file was unreadable. Cross-host carry stays explicit and agent-driven.
- **Environments announce themselves.** `daemonInfo` was **widened** with `host`/`platform`/`arch`
  rather than adding a procedure, so **read those fields as OPTIONAL** — an older daemon returns
  `{ version }` alone. **`unauthorized` is a distinct state from `offline`** (answering and rejecting
  the token means re-pair, not wake), and a non-401 failure re-probes `recentRepos` first, or a
  daemon that 404s `daemonInfo` greys out while working perfectly. One network call per environment,
  so the hook is deliberately lazy.
- **One environment, many endpoints.** (1) **Kind is derived from the address, preference stored by
  kind** — "prefer the LAN here" then survives a DHCP lease change. (2) **Failover is sequential and
  preference-ordered, not a race**: on the home LAN the tailnet address still *works*, just slower,
  so "first to answer" picks the worse route; `unauthorized` short-circuits the walk. (3)
  **Reachability never moves the preference**, only the last-known-good url. Identity comes from the
  daemon's reported `host`, never what the human typed, so a known host MERGES as another endpoint.
  **TRAP — `environmentStatuses` is a WRITER that probes for seconds first:** a load→mutate→save
  after that await resurrects an environment (token and all) removed meanwhile, so every writer goes
  through `updateRemoteEnvironmentState` keyed by id, never an index into a pre-await snapshot.
- **The renderer's WS session is an INSTANCE, not a module singleton** (`primary` is the window's
  binding; flat exports delegate, so call sites are unchanged). *Why:* a remote-bound window must
  still run a terminal on the machine in front of the human — a SECOND live connection, not a
  re-point. Each instance owns its socket, listeners, pendings, backoff. **Don't add a second session
  for anything else** — the window's repo lives on `primary`'s machine.
- **TRAP — the tailnet browser client is an INSECURE context** (plain HTTP on a non-localhost
  origin; WireGuard encrypts the wire, so no TLS by design). `crypto.randomUUID` and
  `navigator.clipboard` **do not exist** there, but do on localhost and in Electron — so this only
  bites the tailnet client. Use `randomId()` / `copyText()` in `lib/utils.ts`. `clipboard.readText`
  has no polyfill (context-menu Paste no-ops; native Cmd/Ctrl+V still works).
- **`ws-protocol.ts` is the single `AppEvent` source** — add an event once, there; both ends validate.

### Routing — the tabs store IS the router

No URL routing, no router library: the active tab's `(kind, path, line)` in `stores/tabs.ts` is the
whole navigation state. `Tab.path` is overloaded per kind. Ids are ALWAYS `tabId(kind, key)`, never
hand-built strings. `Viewer` dispatches with an **exhaustive `switch`** — no default, so a missing
case is a compile error.

- **Preview and pinned are different things.** Preview = single-click, italic, replaced by the next;
  cleared by double-click/edit/non-preview re-open (`pinTab`). Sticky `Tab.pinned` fixes a tab at the
  left of the bar. `pinTab` never sets `pinned`.
- **Split view = panes, not extra tab state.** The invariant: **`openTab`/`pinTab`/`cycleTab`/
  `closeAllTabs` keep their signatures and always act on the active pane**, so every opener stayed
  pane-agnostic. `openTabToSide` targets the other pane; pane-scoped ops take `(paneIndex, id)`.
- **Recipe — new screen/tab kind**, in order: pure logic in `src/backend/<thing>.ts` + sibling test →
  procedure in `api.ts` (only a genuinely Electron-native one goes on `shellRouter`) → hook →
  `TabKind` → view component (one public export, key as a single prop, data via the hook) → opener
  calls `openTab` → `case` in `Viewer` (the compiler forces it) → keyboard binding if needed.
- **Opening a repo is a DAEMON-side directory browser, not a native dialog** — repos are daemon
  paths, so with a remote daemon a Mac dialog picks the wrong machine's. Repo switching is one store
  action (`switchTo`); never clear tabs ad hoc. Both switchers carry a per-row "open in new window"
  leaving this window and its terminals untouched (worktrees get worked side by side).
- **A linked worktree is NOT a project:** `recentRepos` drops paths whose `.git` is a file (one
  `stat`, never a git spawn — the endpoint is hot), so a checkout has one home; they stay in stored
  recents so quitting inside a worktree reopens there.
- **HEAD is reported structurally, never as a label:** `gitHead` returns `{ branch, detachedSha }`
  and the ONE rendering is `headLabel` — that's why nothing string-sniffs `'HEAD'` or invents a
  second "(detached)".

### Data hooks, state, components

- One module per domain — **read the directory; an enumerated list here went stale before.** Query
  options live in the hook, not the component.
- **Hooks own invalidation:** each mutation lists targeted invalidations in `onSuccess`. The ONLY
  blanket `utils.invalidate()` is `useQuickCommand` (pull/stash change everything — a documented
  escape hatch). **No tRPC subscriptions**; push arrives from the daemon WS session and the tiny
  `shell-event` IPC channel under one renderer-facing union.
- **Enforced:** importing `lib/trpc` or `lib/daemon` from `components/**` is a Biome error.

| State kind | Home |
|---|---|
| Server / git / fs | TanStack Query via domain hooks, nowhere else |
| Cross-component UI | a zustand store, one per concern; fine-grained selectors at the leaf, no prop-drilling (sole exception `LeftSidebarHandle`, forced by nested SidebarProviders) |
| Prefs surviving reload | the single persisted `preferences` store. **Nothing else persists** |
| Everything else | component-local `useState` — never for state another component reads |

**Component authoring** (beyond what the surrounding files show). One public component per file;
co-location exceptions are inseparable variant pairs, a component + its companion hook, and mutually
recursive components. Props typed **inline**; a named `XProps` interface only for generic components.
Handlers named by intent (`run`, `save`), **never `handleX`** — prose-only, because Biome can't ban a
prefix. **No app-authored React context** and no boolean-prop variant proliferation: composition is
prop-driven components + zustand, `children` wrappers for menu/boundary shells, render-props only for
generic virtualized lists, Base UI's `render` to merge shadcn triggers.

### Keyboard shortcuts — tiered ownership (deliberate; don't "centralize")

Main-process `before-input-event` **only** to override an OS/Electron default (⌘W) → app-global store
bindings in `use-app-shortcuts.ts` → a component's own listener for its own local state → element
`onKeyDown` for focused-element chords → `SidebarProvider`'s `shortcut` prop.

- **A shortcut firing a tRPC mutation can't live in `use-app-shortcuts.ts`** — that hook sits under
  `components/**` where importing `lib/trpc` is a lint error, so the Files fs-shortcuts live in a
  dedicated always-mounted `file-commands.tsx`.
- **The browser client remaps the primary modifier to Ctrl** (`lib/keyboard.ts`, keyed off
  `isBrowser || isLinuxShell`): browsers own ⌘1–7/⌘T/⌘N/⌘W/⌘P, but Ctrl chords *are*
  page-interceptable. Over a focused PTY the ⌘T/⌘N spawn keys yield to the shell (Ctrl+T/N are
  readline's); ⌘K clear and `terminalEditBytes` stay meta-only so they go dormant in the browser and
  readline owns the equivalents. Labels use the ⌃ glyph, not the word — the OS may still be macOS;
  the trigger is the client, not the platform.
- **`isTextEntry` deliberately excludes `.xterm`** (its hidden textarea reports as editable, yet
  ⌘T/⌘N must still spawn while a PTY is focused). `FileCommands` guards with the inverse
  (`isTerminalTarget`) so destructive ⌘D/⌘⌫ never fire over a terminal.
- **Terminal editing chords are translated in the xterm registry**, not by window listeners. **⌘K
  clears, never Ctrl-K** (= readline kill-to-end-of-line, which must reach the shell); the rest is
  the pure, unit-tested `terminalEditBytes`. ⌥+letter is left alone so Option-compose types accents.
- **"Compose intent" surfaces share a tiny store with ONE dialog mounted in `AppShell`** — mounting
  once avoids two stacked modals when a sidebar list and the viewer board are both mounted.

### Testing

**Most coverage lives in pure daemon-side unit tests — keep logic pure and daemon-side.** Component
tests mock the **domain hooks**, never the tRPC proxy, and shape mock data with `@main` types so drift
breaks the build. No snapshot tests. `src/test-setup.ts`'s stubs are non-obvious: `window.matchMedia`
(any `SidebarProvider` mount needs it), `document.elementFromPoint` (TipTap), and an explicit
`afterEach(cleanup)` because globals are off.

**Playwright:** the **browser** project is day-to-day; the **electron** project is optional (manual
workflow), not a per-push or pre-cut gate. The browser fixture boots an isolated daemon + temp
channels, never the human's prod `~/.porcelain`. Gotchas: `PLAYWRIGHT_FORCE_ASYNC_LOADER=1` is
required; `e2e/tsconfig.json` is self-contained; screenshots are DOM-only, per-project/platform;
prefer element-scoped baselines when a column is tight.

## Repo facts

- Path aliases are defined in **FOUR places that must stay in sync**: `electron.vite.config.ts`,
  `tsconfig.web.json`, root `tsconfig.json` (the shadcn CLI needs it), `vitest.config.ts`.
- `@main` imports in the renderer are **type-only** — a runtime import leaks Node into the bundle.
- **TRAP — the two `createTRPCReact` instances must never share the default TRPC context.** With no
  `context` option it falls back to a module-level singleton, so nesting the shell Provider inside
  the app Provider silently routes ALL app hooks to the shell client ("No procedure found" hang).
- **Shiki tokenization is whole-file, not per-line**, so grammar state carries across line breaks —
  per-line lost it and mis-colored multiline comments and template literals. Diffs reconstruct each
  hunk's old/new image (cross-hunk context is inherently unavailable). Mono ligatures are disabled
  globally so `===`/`=>`/`??` stay legible.
- shadcn components live in `components/ui/` (excluded from Biome). Base UI uses `render`, not
  Radix's `asChild`.
- **Theme is a renderer-local preference applied pre-paint in `main.tsx`.** `index.html` keeps
  `class="dark"` ONLY as the boot flash-guard main.tsx immediately corrects — do **not** read it as
  "hardwired dark". OS chrome follows a `setThemeSource` shell mutation; `nativeTheme` is used ONLY
  there. The resolved theme name is part of the Shiki `tokenCache` key.
- **TRAP — re-applying a shadcn preset overwrites `ui/` AND the color block, and clobbers non-`ui`
  files too.** Afterwards restore: `lib/utils.ts` (custom `extendTailwindMerge` groups +
  `randomId`/`copyText` — the apply rewrites it to the stock 6-line `cn`), `ui/sonner.tsx` (upstream
  pulls `next-themes` back into `package.json`), the sidebar `shortcut` prop + mobile-width constants
  + dual-rail sheet + `dvh` units, the ScrollArea `orientation` prop, and the
  AlertDialogAction-on-`Close` fix. Diff every touched file against HEAD. (`shadcn apply` needs a
  temporary stub `vite.config.ts` to pass framework detection.)
- **The Review's feature view is agent-curated only.** `buildFeatureView` takes **exactly**
  `reviewSet.files` for membership and order, renders the agent's per-file `layer` verbatim, and tags
  listed dirty paths as `changed`. It does **not** union the working tree or auto-expand imports —
  incidental dirty files stay on Changes — and returns **null** with no review set.
- `groupByLayer` (`flow.ts`) is the regex flow grouping (furthest-right match, then alphabetical),
  shared by Changes/History and the explore reader. `terminal-manager.ts` is the one impure,
  non-unit-tested backend module.
- Daemon `userData/config.json` holds recents + global bind flags only. Notes, layers, reviewed marks,
  and scope live under `~/.porcelain/*.json` for one reason: **the CLI ships with no dependencies and
  no app**, so it must read them off disk. Keep new channels there.

## App shell — traps & decisions

- **Multi-window, one repo per window.** Each window is an independent renderer over the ONE
  *stateless* daemon router — every procedure takes `repoPath`, so the backend holds no "current
  repo" and appRouter context is **empty**. Per-connection concerns live on the WS **session** (one
  socket per window) keyed by a structural sender, not a `WebContents`. The lone procedure needing
  the calling window (`windowInit`) lives on the shellRouter.
- **Window-targeted vs broadcast:** watcher events target the session that registered the watch;
  agent-channel app-events **broadcast**, because each window invalidates only its own repo-keyed
  query so cross-window delivery is a harmless no-op refetch. **Don't add a window→repo registry to
  "fix" it.** `close-tab` / `update-status` / `maximized-changed` are shell events, never daemon
  events; the last is window-targeted because it's about ONE window's state.
- **TRAP — `windowInitFor` must stay an IDEMPOTENT read (do NOT delete-on-read):** the boot effect
  runs under `StrictMode`, so a one-shot read lets the second boot fall back to `restore` and clone
  the last repo. Pending init is cleaned up on window *close*.
- **macOS menu:** keep the `editMenu` role (a custom menu strips ⌘C/V from inputs) and keep
  reload/devtools **dev-gated** (prod deliberately ignores ⌘R). `electron-devtools-installer` stays a
  **devDependency** — it must not ship.
- **Chrome heights are coupled.** Titlebar, rail/panel headers, viewer header, right-sidebar header
  are all `h-12`, and `trafficLightPosition` is tuned to that 48px titlebar. Change it and the traffic
  lights drift.
- **The two floating sidebars are pushed below the titlebar with `md:` classes, never an inline
  style** — shadcn pins their container to the full viewport, and the mobile Sheet reuses the same
  props, so an inline offset makes the drawer begin 3rem below the viewport. The center
  `SidebarInset` is `h-full`, not `h-screen` (which overflowed 48px past the bottom).
- **Window chrome is platform-split; traffic lights are macOS-only.** Linux/Windows get
  `frame: false` and a renderer-drawn `WindowControls` calling shell procedures that act on the
  calling window. The maximize glyph must track OS-driven state (WM shortcut, drag-region
  double-click), hence the `maximized-changed` event.
- **Collapse-all is a nonce, not a store of expanded paths.** Expansion is per-`DirNode` local state
  because the tree reads lazily, so collapse-all bumps `collapseNonce` and nodes collapse in an effect
  keyed on it (skipping mount, so a reveal-expanded node isn't snapped shut). **Don't add a central
  expansion store to "fix" this.**
- **Resize handles write the CSS variable directly during the drag and commit to the store only on
  mouseup** — a store write per `mousemove` re-renders the whole app.
- **`VirtualRows` is fixed-height by default — the perf invariant.** File/diff/source viewers MUST
  stay fixed-height (measuring every row is what the virtualizer exists to avoid). The lone opt-in is
  `dynamicHeight`, used only by the small, sliced reading surface; it also publishes the viewport
  width as `--vrows-vw` straight to the DOM in a `ResizeObserver` (the resize-handle trick) so a
  wrapping row sizes to the viewport, not the `w-max` content. Don't enable it on a large surface.
- **Two nested SidebarProviders**; the inner takes `shortcut="."` so both don't grab ⌘B. The two
  `TopBar` toggle icons are **deliberately different** (`PanelLeft` / `Zap`) — never mirror-image
  icons. **Both toggles must call that provider's `toggleSidebar`**, not write the open preference
  alone: below the mobile breakpoint the shell is a Sheet driven by `openMobile`, and flipping only
  the desktop flag leaves it closed.
- **Phone is "quick look", not a full workspace** (iPad ≥768 keeps the desktop floating layout).
  Below 768px the Sidebar becomes a Sheet, and because our left shell is a dual-rail the mobile body
  must be **`flex-row`** (the default `flex-col` stacked the rail on the list). Also: auto-close the
  left sheet when the active viewer tab changes; force unified diffs (split needs two columns); drop
  traffic-light spacers in the browser titlebar; safe-area padding. Deliberately **not** a touch
  redesign of every surface — glanceable review, not an iPhone IDE.
- **One opaque design — the glaze glass system is DELETED.** The app targets a plain browser as a
  first-class client, and neither it nor Linux Electron can do macOS vibrancy — a glass design that
  works on one target isn't one design. `.glaze-*`, the `--surface-*`/`--hover-fill`/`--selected-fill`
  tokens, and window vibrancy are gone; don't reintroduce a `Surface` wrapper or a glass material.
  **One carve-out:** the preset ships translucent menus and was taken as-is; that licenses no new
  glass elsewhere. The Porcelain tokens block layers ONLY semantic/diff/ink colors, so it survives a
  preset re-apply.
- **Surface recipes.** Raised = `rounded-* border bg-card`; recessed wells = `rounded-lg border
  border-border/60` + `bg-muted`; settings groups = `rounded-md border bg-muted/40` (never per-row
  `bg-card` pills). Row/card action classes come from `lib/controls.ts` — **an inline `h-7 text-xs`
  outside it fails `pnpm lint`.** Don't inline the constant into `ui/button.tsx`; vendored files are
  overwritten on re-apply. **TRAP — always pair a text size with its `md:` twin** when overriding the
  vendored Input: it ships `md:text-sm` for the iOS zoom-safe base, so without the twin desktop keeps
  `sm`.
- **One interaction language:** `bg-accent` (or `bg-sidebar-accent`) = lit/selected, `bg-accent/50` =
  resting hover, everywhere. These are the preset's own tokens, **not** re-pointed by the Porcelain
  block, so a re-apply is safe. Never invent a fresh opaque shade. `--muted` backs *static* surfaces.
- **No decorative accent — color only for meaning.** The only surviving color is functional: git +/−,
  file-type icons, folder/status hues, terminal ANSI. Don't reintroduce a CTA accent.
- **TipTap is a scoped exception, allowed ONLY in the Notes card.** The file viewer stays a plain
  textarea over a Shiki backdrop — no CodeMirror/Monaco, no autocomplete/rename/format (those make it
  an editor).
- **The editor adopts external file changes ONLY when clean** — `EditorSource` reloads from a changed
  prop only if there are no unsaved edits; mid-edit the user's text wins. Don't make it always adopt
  (clobbers edits) or never adopt (the stale-view bug this fixed).
- **Markdown reader is NOT virtualized** — never route code files through it. Reader links get
  `target="_blank"` → `setWindowOpenHandler`, gated by `isSafeExternalUrl`.
- **HTML files open in a built-in sandboxed preview**, same `sandbox=""` as the Review's diagram and
  evidence iframes — never add allow-* tokens.
- Base UI requires `DropdownMenuLabel` inside `DropdownMenuGroup`, or it throws `MenuGroupContext
  missing`.
- **Tree Delete = the `trash` npm package** (recoverable), never a permanent unlink; the one
  destructive tree action, so it confirms via an `AlertDialog`.
- **Agent channels are watched JSON under `PORCELAIN_HOME`, driven by the dependency-free porcelain
  CLI.** Read `src/cli/` and the stores it mirrors for the current set — an enumeration here rots.
  **Do not re-add a Porcelain MCP server** without reopening the channel design. Channel write-safety
  rules live in `audit` — read it before touching any channel file.
- **TRAP — the CLI's `DEFAULT_LAYERS` is a deliberate duplicate of `flow.ts`'s**, because the CLI may
  not import backend code. The duplication is *guarded* by a test asserting the two are identical, so
  edit both together.
- **Explore's flow reading is a heuristic, not an index** — relative imports only, so it won't cross
  the client→server seam. That gap is what the agent's `shipped` files fill.

## Terminal subsystem (the one place the one architecture deliberately bends)

A terminal is a live bidirectional byte stream, not request/response data.

- **`node-pty` is the one native module**, reversing the old native-module-free property — a real PTY
  has no pure-JS equivalent. Packaging consequences are `audit` invariants.
- **The terminal rides the daemon WS session, NOT tRPC and NOT a preload channel.** Create/attach ride
  the WS; list/rename ride tRPC. Lifecycle control lives here, not in a hook — a terminal isn't
  TanStack-Query data. tRPC stays for Actions *definitions*, which are data.
- **PTYs are daemon-owned and survive disconnect, reload, tab close, and repo switch.** A session has
  a *set* of attached senders (output fans out; writes/resize last-write-wins); socket close
  **detaches, never kills**, and a reconnecting or second client attaches to replay scrollback. Only
  an explicit kill, the daemon dying, or the bounds below end a PTY.
- **A terminal is a `TabKind`, so split view and tabs come for free** — no bespoke panel. Terminal tabs
  open **pinned** (a click must not replace a running shell). **One xterm instance = one DOM node =
  one pane:** unlike a file a terminal lives in only ONE pane, so `openTab` activates it in place and
  `openTabToSide` **moves** it; `detachTerminal` is container-scoped so the old pane can't yank the
  wrapper back and blank the new one. Don't "simplify" back to the generic clone path — that's the
  blank-pane bug.
- **xterm instances live in a module registry, NOT in React.** The viewer only mounts the active tab,
  so a `Terminal` in component state would be destroyed (losing scrollback, detaching a background dev
  server) on every tab switch. Each session's `Terminal` opens into a detached wrapper `<div>` the
  view re-parents on mount and detaches — **never disposes** — on unmount. Early PTY output is
  buffered until the instance exists.
- **Decoupled is not unbounded — three lifecycle bounds.** Without them a long-lived daemon reached
  228 sessions and an 8.7 GB peak with orphaned shells. An **exited** entry is forgotten 10 min after
  exit (final output survives a reload, not the week); a **running** one with nobody attached is killed
  after **12h** (deliberately generous — the dev server you return to tomorrow must live, the shell you
  forgot must not); `MAX_SESSIONS` (64) evicts cheapest-first and **throws** rather than kill a session
  a human is watching. **A session with an attached client is never reaped by any of the three** — that
  is what keeps the decoupling honest. The sweep is ONE lazily-started `unref`'d 60s interval, never a
  timer at import. Every path that can empty `attached` (including `fanOut` dropping a destroyed
  sender) must start the idle clock, or a session detaches invisibly and never expires. The cap's throw
  is answered as `terminal:created { id: '' }` — that message has no error channel, and an unsettled
  create would wedge the client's pending promise.
- **Nerd Font fallback, not a font swap:** Geist Mono *then* `"Symbols Nerd Font Mono"` (vendored MIT)
  so text renders in Geist Mono and powerline/devicon glyphs fill per-glyph instead of tofu.
  Terminal-only; the **Mono** variant is required (single-cell, aligns to the grid).
- **OSC 52 clipboard is write-only and host-side.** Agents and vim/tmux copy by emitting OSC 52 and
  xterm doesn't handle it, so without this a remote copy prints "sent N chars" and the host clipboard
  stays empty. **Deliberately no OSC 52 *read*** — that would report the system clipboard to the
  remote PTY (exfil).
- **Selection Copy chip:** `mousedown` preventDefault is load-bearing — without it, pressing the chip
  clears the selection before the click. Complementary to OSC 52 (app-driven vs user selection). We
  deliberately do not ship "Add to chat".
- **Paint path is one decision: WebGL with automatic DOM fallback, no Settings toggle.** The DOM
  renderer snaps the font to the grid with a computed `letter-spacing`, which shows as a hairline
  **vertical gap between every column** for contiguous block/box-drawing glyphs (agent startup logos,
  powerline fills); `lineHeight > 1` adds the horizontal twin, so keep `lineHeight: 1.0`. Only GPU
  renderers get `customGlyphs`, and the WebGL atlas still does per-glyph font fallback so Nerd Font
  glyphs survive. Load it best-effort *after* `term.open()`, in a try/catch, with
  `onContextLoss → dispose`, so no-WebGL or a lost context degrades to DOM rather than a blank pane;
  multi-touch **force-DOMs**, because WebGL contexts die under memory pressure. **e2e trap:** WebGL
  paints to a `<canvas>` and leaves `.xterm-rows` empty — specs use the buffer-model helper.
- **Touch is a first-class terminal client, and the seam is `isCoarseTouch()`, NOT the phone width
  breakpoint** — an iPad sits at desktop width and still has no Ctrl key.
  - **`attachTerminal` deliberately does NOT focus xterm on a coarse-touch device.** Focusing the
    hidden helper textarea raises the iOS keyboard, and attach runs on every mount, so auto-focus meant
    an iPad could never just *read* scrollback. Focus is explicit (tap-vs-pan within ~10px, or the key
    bar's Keyboard button). Don't restore it.
  - **Touch scroll traps:** xterm only scrolls on **wheel**, so finger pans need our adapter; Safari
    needs **`touch-action: none`** or it rubber-bands and ignores `preventDefault`; listeners use
    capture + Pointer Events with `setPointerCapture` so moves aren't lost; the **alternate buffer** has
    no scrollback, so `scrollLines` is a no-op there. **Never send arrow keys and never a synthetic
    `WheelEvent`** — a non-trusted wheel falls through xterm's no-scrollback path into CSI A/B, which
    agents reject. Correct alt-buffer path: **SGR wheel bytes** when mouse mode includes wheel, else
    PageUp/PageDown. Normal buffer: `scrollLines`.
  - **The key bar is TOUCH-ONLY, always on, no Settings opt-out** — the device decides. It sits at the
    **TOP** of the pane, because the iOS keyboard covers the bottom of the visual viewport and a bottom
    bar was hidden exactly when you were typing. Traps: (1) **sticky Ctrl rides a store keyed by session
    id** so split view can't cross-fire; it disarms on ANY key, and a lone modifier keydown is skipped so
    Shift-then-letter still works. (2) **Focus preservation is the whole trick** — each key
    preventDefaults `mousedown` and samples focus at pointer-down to restore it, but *only when the
    terminal already had it*, or Esc would raise a keyboard the human just dismissed; the Keyboard toggle
    opts out. (3) **Arrows must read the live DECCKM state** — the bar writes bytes directly, so an
    unconditional `ESC [ A` inserts a literal `[A` in vim. (4) Tests need the `touchDevice` fixture:
    Playwright's `hasTouch` reports a single point, which `isCoarseTouch` reads as a pen.
- **"This device" terminals — a remote-bound window can run a shell on the machine it's displayed on.**
  (1) **Local-only, not general multi-daemon:** the second session exists ONLY for work explicitly about
  the other machine; every repo-scoped query stays on `primary`. (2) **The cwd is a stored MAPPING, not
  a guess** — the remote repo path rarely exists locally, so the human maps it, keyed by environment AND
  repo path (two machines commonly hold the same path); it lives shell-side because it's a fact about
  THIS machine's filesystem. (3) **+ is a menu only when remote.** (4) Saved actions pick the machine via
  `where: primary|local`. (5) **Terminal ids are routed, not namespaced** — `sessionForTerminal` is the
  ONE place anything asks which daemon owns a PTY, and local ids are re-registered on every roster
  hydrate so a surviving session is routable before anything writes to it. (6) **Both rosters hydrate in
  ONE call** — `hydrate` REPLACES, so a call per daemon leaves only the last. (7) Electron-only by
  nature, so the browser client hides it rather than half-supporting it. **Verification trap: no suite
  covers this** (the browser project has no shell router; the native fixture always boots local). It was
  verified with a scratch harness seeding `remote-daemon.json` against a second standalone daemon and
  asserting the PTY exists on the LOCAL daemon with the mapped cwd. Re-verify that way.
- **`initialInput` is written after a quiet period keyed on the output's shape — NEVER at spawn, and NOT
  on the shell's first output.** Anything written before readline preps the tty is echoed but DISCARDED,
  so the command never runs. A spawn-time write failed two release gates; "first output = readline is
  up" failed a third (a shell's first chunk is its startup banner, still pre-readline on a slow runner).
  The reliable signal is the PROMPT — the only output whose tail has no trailing newline — so a
  prompt-shaped chunk arms a short debounce and a newline-terminated one a long one (also the from-spawn
  fallback for silent shells). The e2e specs obey the same law: wait for the prompt before typing.

## Deliberately absent

| Not built | Why |
|---|---|
| In-app agent runner / chat threads | ~18k lines and a 40% fix rate in 16 days for a surface its author used twice. The Review is fed by the **porcelain CLI**, so an agent in Porcelain's terminal, another emulator, or over SSH publishes the same Review. Reopen `product`'s "Companion, not competitor" before rebuilding |
| Porcelain MCP server | Channels are the CLI writing local JSON |
| Agent chat / relay channel | Agent-to-agent messages with file claims and overlap detection weren't worth the maintenance; coordinating parallel agents is not a problem Porcelain claims to solve |
| Standalone artifact + evidence tab kinds | Folded into the Review canvas — one document, not a second narrative surface beside it |
| Glaze / vibrancy / a `Surface` wrapper | See "One opaque design" |
| A fleet-wide shared daemon token | Per-device credentials, individually revocable |
| Config→channel migrations, upgrade shims | Pre-audience: **no one-shot migrations from retired formats**; corrupt or unknown shapes → empty/default. Don't re-add `migrate*FromConfig`, `evidence.json`, action `cwd`, bare-string reviewed marks, or the single-`{url,token}` remote-daemon parse |
| Linux/Windows desktop packaging | A *distribution* decision only: nobody ran the unsigned Linux build and its failure could block a fine Mac release. **Every Linux runtime path stays** — `resolvePlatform`/`PORCELAIN_FORCE_LINUX`, `isLinuxShell`, renderer-drawn window controls, Ctrl-primary keybindings. Don't "clean up" those as dead code; the daemon ships to Linux via npm and the browser client is how Linux humans get a seat |

**Still product, not trash:** WebGL→DOM terminal fallback; dual primary+local daemon sessions;
`exportRepoSettings`/`importRepoSettings`; Linux shell chrome; `feature` internal ids while the UI says
Review (the rename is a structural project).

## Packaging, release, conventions

`electron-builder.yml`: mac dmg + zip (arm64 — the **zip** is what electron-updater downloads), hardened
runtime, Developer ID signing. Auto-update no-ops unless `app.isPackaged`. The porcelain CLI is a
**second main build input** importing only Node builtins, so a plain `node` runs it. Release is simple
main + tag: `pnpm release:cut` (default **patch**) bumps, tags, and dispatches one workflow that
packages, publishes the GH Release, and publishes npm `porcelain-daemon` — no pending branches, no
multi-workflow pre-cut gate, native e2e optional. Runbook: `releasing`. Dep placement and the
empty-`CSC_LINK` trap are `audit` invariants.

- shadcn primitives only; a new primitive needs the human's approval.
- Strict TS, no `any`, no `as unknown as`, no dead code, no commented-out code.
- Conventional Commits. Gate before any commit: `pnpm verify`.
- Managed worktrees are runtime-isolated (unique port, per-slug channels/user data/playground).
  `PORCELAIN_DEV_PLAYGROUND` carries the seed into the daemon and **must stay in `terminal-env.ts`'s
  scrub list**.

## Nomenclature

The lookup table for bare nouns. When the human says one, act on that region — don't re-ask. The file in
parens is the **entry point**; read it for mechanics.

**Shell regions (outside-in)**

| Term | Entry | Note |
|---|---|---|
| Top bar | `title-bar.tsx` | The full-width titlebar. **Not** the viewer's header (`TopBar` in `app-shell.tsx`) |
| Environment switcher | `environment-switcher.tsx` | **Always rendered, local or remote** — a Remote-only chip couldn't be how you *go* remote. Static label in the browser |
| Sidebar (unqualified = left) | `app-sidebar.tsx` | Icon rail + content panel (⌘B); footer = branch chip + worktrees picker |
| Viewer | `shell/viewer.tsx` | The central panel. **Never "editor"** |
| Quick Access | `right-sidebar.tsx` | The right panel (⌘.); contents follow the active sidebar tab |

**Sidebar tabs** — Files · Changes · Review · History · Search · Board · Terminal (review-loop order,
⌘1–7; the Review tab's stored pref id is still `feature`).

| Term | Entry | Note |
|---|---|---|
| File tree | `file-tree.tsx` / `tree-node.tsx` | |
| Search list | `search-list.tsx` | `gitSearchCode`; distinct from the ⌘⇧F `ContentSearch` overlay (`gitGrep`) |
| Changes list | `changes-list.tsx` | Grouped by flow layer |
| History list | `history-list.tsx` | |
| Feature list | `feature-list.tsx` | Header + file outline. **Intent/Execution/Evidence live only in the viewer canvas** |
| Review inbox | `review-inbox.tsx` | Other worktrees with work awaiting review; rows from `worktree-inbox.ts` |
| Board list | `board-list.tsx` | todo/doing/done cards |
| Terminal list | `terminal-list.tsx` | Roster of **sessions** — they outlive their tabs |
| Key bar | `terminal-key-bar.tsx` | Above the terminal pane; coarse-touch only, never a Settings option |
| Selection Copy | `terminal-selection-toolbar.tsx` | Host clipboard via `copyText`, not OSC 52 |

**Inside the viewer**

| Term | Entry | Note |
|---|---|---|
| Glance | `glance-home.tsx` | Companion home an empty pane renders with a repo open |
| Tab bar / Tab | `tab-bar.tsx` | Preview = single-click, italic, replaced; pinned = double-click/edit |
| Split view / pane | `stores/tabs.ts` | Two panes, each its own tabs; "Open to the Side" |
| Tab kinds | `viewer.tsx` switch | file / source / markdown reader / html preview / diff / commit / review / search / feature / explore / board / terminal. **The `feature view` IS the Review canvas** |

**Inside Quick Access** (section follows the sidebar tab)

| Sidebar tab | Quick Access |
|---|---|
| Files | Pinned + Notes card |
| Search | Recent searches |
| Changes / History / Feature | Quick commands — a Suggested card over the Commands grid |
| History | File timeline (`gitFileLog --follow`) |
| Changes / Feature | Commit composer + Comments |
| Terminal | Actions |
| Board | Focus — full detail of the selected card; selection is client-only, **not** a second kanban |
| Feature | **Reading companion only** (`review-group.tsx` + Comments) — deliberately not a clone of Changes' git commands/commit. "Clear review & evidence" is an inline button here |

**Overlays:** file finder (⌘P) · find bar (⌘F) · Settings (`settings-dialog.tsx` — General · Share ·
Remotes · Review flow · Updates) · welcome screen.

**Cross-cutting** (the *what*/*why* live in `product`; internals here and in `audit`)

| Term | Meaning |
|---|---|
| Flow / flow layers | Architectural-layer grouping of changes (entry-point → data); the heart of "review as a story" |
| The Review (feature view / review set) | One unit-of-work story as a three-tab canvas: **Intent** (thesis + walkthrough prose, optional freeform HTML/Excalidraw), **Execution** (agent-listed files + notes, not the working tree), **Evidence**. Files tagged **changed** / **context** / **shipped**. Manifest: `review-sets.json`. Product language is **Review**; code may keep `feature` ids |
| Evidence | Agent-authored self-contained HTML *proof the loop closed*; directory-on-disk under `loop-evidence/<key>/`; app write = clear only. Excalidraw is Intent-only. Ephemeral |
| Review comments | The reviewer's line/file notes (`comments.json`), app→agent via the CLI |
| Reviewed marks | Per-file "reviewed" checkboxes (`reviewed.json`), app→agent, read-only like notes |
| Project board | Per-repo todo/doing/done (`board.json`), two-way via the CLI |
| Actions | Saved named commands (`actions.json`); agent curates, **human runs** |
| Daemon | The headless Electron-free backend (`src/backend/server.ts`) the renderer reaches over HTTP + one WS; the shell spawns and babysits it (`src/main/daemon.ts`). "The daemon" always resolves here |
| Surface language | The opaque design: raised = cards, recessed = wells, hover/selected = `bg-accent`/`bg-accent/50`. Menus are the one translucent exception. ONE design serves Electron and the browser alike |
