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
  contracts/       wire protocol + full public procedure I/O (99 names)
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
| 4 | Contracts: no apps imports; full procedure I/O catalog | **Done** (99 names, 56 refined, drift lint) |
| 5 | client-runtime shared pure core; forks deleted | **Done** for protocol/keys/word-diff; session **lifecycle** stays per app (platform APIs differ) |
| 6 | All package versions identical via sync-versions | **Done** |
| 7 | Linux default = daemon + web | **Done** (docs + packaging story) |
| 8 | Agent docs match tree; verify green | **Done** when `pnpm verify` passes on this revision |

Residual (not blockers for resuming product work):

- Daemon routers still author some zod inputs locally; adopt contracts inputs over time.
- Mobile procedures beyond connection still use local zod mirrors; prefer contracts schemas when touched.
- Two word-diff algorithms in client-runtime (line vs tokens) — intentional presentation split.
- Runtime artifacts still land under `apps/desktop/out/` for shell spawn + dist-daemon layout.

## Non-goals (closed)

Effect rewrite, procedure rename, Android, merging mobile UI into web, in-process desktop backend.
