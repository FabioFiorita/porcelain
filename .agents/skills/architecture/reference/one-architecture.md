# The one architecture

```
daemon (src/backend/api.ts procedures + pure logic in own modules; Electron-free, HTTP/WS on 127.0.0.1)
  → lib/trpc.ts (appRouter client) + lib/daemon.ts (the WS session) — imports restricted to hooks/ and stores/
    → hooks/use-<domain>.ts (queries, mutations, invalidation)
      → components/<area>/*.tsx (UI only; consume hooks + stores)
stores/ (zustand: client-only state — tabs, repo, preferences, selection)

shell (src/main/shell-api.ts) — a SEPARATE thin surface: the few Electron-native procedures
  (dialogs, windows, updater) over tRPC-over-IPC, its own client (shellTrpc)
```

## The daemon — client/server always, even fully local

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
- **`packages/contracts` vs `src/shared` is a boundary, not a folder preference.** `@porcelain/contracts`
  holds shapes that cross a **client** boundary (the WS protocol; `AppRouter` behind
  `@porcelain/contracts/router`) so the renderer, `apps/mobile`, and the CLI share one definition;
  `src/shared` is code shared between the **desktop processes**, which a sibling workspace can't
  reach and doesn't need. Don't migrate `src/shared` wholesale — move a module only when a second
  client actually needs it. *Traps:* the package is resolved by **alias**, never a root
  `dependencies` entry — electron-vite externalizes declared deps, which would put a bare
  `require("@porcelain/contracts")` inside the dependency-free CLI bundle. And the default entry
  stays zod-only: the router type drags the daemon's type graph (Node typings,
  `__PORCELAIN_VERSION__`) into anything that imports the barrel, which Expo's tsconfig rejects.

## Routing — the tabs store IS the router

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

## Data hooks, state, components

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

## Keyboard shortcuts — tiered ownership (deliberate; don't "centralize")

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

## Testing

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
