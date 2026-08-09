# Architecture charter

Product surfaces and package boundaries. For data-flow traps inside a surface, see
`one-architecture.md`.

## Product surfaces

| Surface | Role | Runs without |
|---------|------|----------------|
| **Daemon** | Headless runtime: git, fs, review, board, PTY, share, HTTP/WS | Electron, any UI |
| **CLI** | Agent channel (`porcelain` binary, Node builtins only) | App UI |
| **Web** | React human UI (browser and Electron load the same client) | Electron shell |
| **Shell** | Electron: windows, menu, updater, spawn local daemon, load web | Business logic |
| **Mobile** | iOS client against the same daemon | Desktop shell |

Linux first-class path: **daemon + web** (browser). Mac can add the shell. Mobile is a peer client.

## Package map

```
apps/
  daemon/     @porcelain/daemon     plain Node runtime (+ porcelain-daemon npm)
  cli/        @porcelain/cli        agent CLI (installed by daemon into home)
  web/        @porcelain/web        React client (Vite)
  desktop/    @porcelain/desktop    thin Electron shell + Mac package only
  mobile/     @porcelain/mobile     Expo iOS

packages/
  contracts/       wire protocol + public procedure catalog (113 names; 63 refined I/O)
  client-runtime/  non-UI client core (session protocol, keys, word-diff)
  shared/          pure cross-cutting helpers (home, platform, ids, …)
```

| Package | Build |
|---------|--------|
| `apps/daemon` | `pnpm build:daemon` — esbuild → `desktop/out/main/daemon/server.js` |
| `apps/cli` | `pnpm build:cli` — esbuild single-file CJS → `desktop/out/main/cli/porcelain.js` |
| `apps/web` | `pnpm build:web` — Vite → `desktop/out/renderer` |
| `apps/desktop` | electron-vite **shell only** on prod; HMR web source under `pnpm dev` |
| Full product | `pnpm build` — mobile typecheck + web + shell + node runtime |

## Dependency direction

```
desktop  →  daemon, web, contracts, shared
web      →  client-runtime, contracts, shared
mobile   →  client-runtime, contracts, shared
daemon   →  contracts, shared
cli      →  shared

contracts      →  nothing under apps/
client-runtime →  contracts
shared         →  (none)
```

Hard rules:

1. **Contracts never import apps.** Procedure I/O lives in contracts.
2. **One wire.** Clients share procedureIo / refined schemas; drift linted.
3. **Daemon always.** Local and remote share one code path. No in-process shell backend.
4. **Independent builds.** Daemon and CLI without electron-vite; web has its own Vite pipeline.
5. **One terminal-native exception.** `apps/mobile/modules/porcelain-terminal` is the sole native
   rendering exception: it owns only Ghostty terminal cells and input, while the React Native
   terminal feature retains the daemon/PTY transport and all app chrome. It is not a reusable
   native UI layer or precedent for platform-specific screens.

## Versioning

**One product version everywhere.** `scripts/sync-versions.mjs` (+ lint `--check`).
Canonical stamp: `apps/desktop/package.json` (electron-builder) until release prefers
`apps/daemon`. Mobile `app.config` reads `package.json.version`.

## Definition of done (refactor program)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | No daemon / CLI / web business logic under `apps/desktop` | **Done** (only main/preload/packaging) |
| 2 | Daemon and CLI build without electron-vite | **Done** (`build-node.mjs`) |
| 3 | Web builds with its own Vite pipeline | **Done** (`apps/web` vite) |
| 4 | Contracts: no application imports; exhaustive exact procedure I/O | **In progress** (113 names, 63 refined; one legacy app-type tombstone and 50 unknown fallbacks are ratcheted debt) |
| 5 | client-runtime shared nonvisual semantics; platform adapters stay per app | **In progress** (pure protocol/keys/word-diff leaves exist; query, mutation, notification, error, and session state semantics are not shared yet) |
| 6 | All package versions identical via sync-versions | **Done** |
| 7 | Linux default = daemon + web | **Done** (docs + packaging story) |
| 8 | Agent docs match tree; verify green | **Done** when `pnpm verify` passes on this revision |

Residual (not blockers for resuming product work):

- Daemon routers still author Zod inputs locally; completed domain cutovers consume exhaustive
  contracts and delete the router-local copy.
- Mobile still has local Zod procedure mirrors. They are deleted by domain cutovers, not extended.
- Two word-diff algorithms in client-runtime (line vs tokens) — intentional presentation split.
- Runtime artifacts still land under `apps/desktop/out/` for shell spawn + dist-daemon layout.

## Non-goals (closed)

Effect rewrite, procedure rename, Android, merging mobile UI into web, in-process desktop backend.
