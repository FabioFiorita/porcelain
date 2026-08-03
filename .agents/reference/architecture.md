# Architecture charter

Product surfaces and package boundaries. Feature work is paused until the monorepo
matches this map. For data-flow traps inside a surface, see `one-architecture.md`.

## Product surfaces

| Surface | Role | Runs without |
|---------|------|----------------|
| **Daemon** | Headless runtime: git, fs, review, board, PTY, share, HTTP/WS | Electron, any UI |
| **CLI** | Agent channel (`porcelain` binary, Node builtins only) | App UI |
| **Web** | React human UI (browser and Electron load the same client) | Electron shell |
| **Shell** | Electron: windows, menu, updater, spawn local daemon, load web | Business logic |
| **Mobile** | iOS client against the same daemon | Desktop shell |

Linux first-class path: **daemon + web** (browser). Mac can add the shell. Mobile is a peer client.

## Target package map

```
apps/
  daemon/     @porcelain/daemon     plain Node runtime + porcelain-daemon npm
  cli/        @porcelain/cli        agent CLI (installed by daemon into home)
  web/        @porcelain/web        React client (Vite)
  desktop/    @porcelain/desktop    thin Electron shell + Mac package only
  mobile/     @porcelain/mobile     Expo iOS

packages/
  contracts/       wire protocol + full public procedure I/O schemas
  client-runtime/  non-UI client core shared by web + mobile
  shared/          pure cross-cutting helpers (home, platform, ids, …)
```

**Migration status:** the tree is mid-move.

| Target | Status |
|--------|--------|
| `packages/shared` | Extracted |
| `packages/contracts` | Exists; full procedure I/O + drop apps import still open |
| `apps/daemon` / `cli` / `web` | Still under `apps/desktop/src/{backend,cli,renderer}` |
| `packages/client-runtime` | Not started |

Treat remaining desktop folders as **future package contents**, not shell features.

## Dependency direction

```
desktop  →  daemon, web, contracts, shared
web      →  client-runtime, contracts, shared
mobile   →  client-runtime, contracts, shared
daemon   →  contracts, shared
cli      →  shared  (contracts only if a command needs wire shapes)

contracts      →  nothing under apps/
client-runtime →  contracts, shared
shared         →  minimal (zod only if required)
```

Hard rules:

1. **Contracts never import apps.** Procedure I/O lives in contracts; daemon routers consume it.
2. **One wire.** Desktop and mobile do not invent parallel procedure shapes.
3. **Daemon always.** Local and remote share one code path. No in-process backend in the shell.
4. **Independent builds when done.** Daemon and CLI build without electron-vite; web has its own Vite
   pipeline; desktop packs shell + loads web + spawns daemon.

## Versioning

**One product version everywhere.** Every workspace package that carries a `version` field shares
the same semver (daemon, cli, web, desktop, mobile, contracts, client-runtime, shared, …).

- `scripts/sync-versions.mjs` is the chokepoint: reads the canonical stamp, writes all others.
- Canonical stamp today: `apps/desktop/package.json` (electron-builder). Moves to
  `apps/daemon/package.json` when the daemon package owns the product heart.
- `release-cut` bumps once, syncs all, then tags. Mobile `app.config` reads `package.json` so Expo
  does not drift.
- No separate mobile marketing version. Store build numbers may differ; **semver does not**.

## Non-goals (this program)

- Effect / event-sourcing rewrite
- Renaming tRPC procedures on the wire
- Android
- Merging mobile UI into web
- Reintroducing an in-process desktop backend
- Feature work until the definition of done below is true

## Definition of done

1. No daemon / CLI / web business logic under `apps/desktop`
2. Daemon and CLI build without electron-vite
3. Web builds with its own Vite pipeline
4. `packages/contracts` has zero imports into `apps/*` and covers full public procedure I/O
5. Web and mobile share full `client-runtime` core; duplicate session/protocol/pure forks deleted
6. All package versions stay identical via sync-versions
7. Linux default story is daemon + web; shell is optional
8. Agent docs match the tree; `pnpm verify` green; Mac app + `porcelain-daemon` + CLI install still work

## Program order

1. Charter + version sync (this doc)
2. Contracts full public surface + drift check
3. `packages/shared`
4. `apps/daemon` + independent build
5. `apps/cli` + independent build
6. `apps/web` + independent build
7. Thin `apps/desktop`
8. `packages/client-runtime` + delete dual-client forks
9. Workspace finish (tests, scripts, audit paths, agents)

Land on `main` as stacked green commits. Wire bytes, ports, and homes stay stable across moves.
