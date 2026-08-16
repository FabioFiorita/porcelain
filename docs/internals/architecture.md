# Architecture charter

Porcelain is a review layer for agentic coding. The daemon owns project work and serves one flat
wire surface; Web, Desktop, and mobile are clients of that daemon. The package and domain rules in
[`domain-architecture.md`](domain-architecture.md) are landed and enforced.

## Product surfaces

| Surface | Role | Runs without |
|---------|------|----------------|
| **Daemon** | Headless runtime for Projects, Files, Git, Review template, Tasks, Actions, Terminal, sharing, HTTP/WS | Electron and every UI |
| **CLI** | Agent channel and project companion tooling | App UI |
| **Web** | React client used directly in a browser and loaded by Electron | Electron shell |
| **Shell** | Thin Electron lifecycle, windows, menus, updater, and local-daemon process owner | Business logic |
| **Mobile** | Native client against the same daemon and contract catalog | Desktop shell |

Linux's first-class path is daemon + Web in a browser. Mac can add the shell. Mobile is a peer
client, not a second backend.

## Package map

```text
apps/
  daemon/     @porcelain/daemon     plain Node runtime and HTTP/WS server
  cli/        @porcelain/cli        dependency-light agent CLI
  web/        @porcelain/web        React/Vite client
  desktop/    @porcelain/desktop    thin Electron shell
  mobile/     @porcelain/mobile     Expo native client

packages/
  contracts/       wire protocol and ten-domain procedure catalog
  client-runtime/  nonvisual query, mutation, realtime, session, and pure UI semantics
  shared/          pure cross-cutting helpers
```

| Package | Build |
|---------|-------|
| `apps/daemon` | `pnpm build:daemon` — esbuild Node output |
| `apps/cli` | `pnpm build:cli` — dependency-light single-file CLI |
| `apps/web` | `pnpm build:web` — Vite output |
| `apps/desktop` | electron-vite shell; development loads the Web client |
| Full product | `pnpm build` — mobile typecheck plus Desktop/Web build |

## Dependency direction

```text
desktop  →  daemon, web, contracts, shared
web      →  client-runtime, contracts, shared
mobile   →  client-runtime, contracts, shared
daemon   →  contracts, shared
cli      →  shared

contracts      →  nothing under apps/
client-runtime →  contracts
shared         →  no product package
```

The contracts package owns the exact 96-procedure catalog and all cross-client wire shapes. The
daemon's composition root merges canonical domain routers into that flat surface. No in-process
Desktop backend exists, so local and remote clients follow the same daemon path. Components do not
import transport clients; Web and mobile feature adapters/hooks own transport access, while
client-runtime owns shared nonvisual semantics.

Hard rules:

1. Contracts never import applications.
2. Every public procedure has one operation and one canonical domain router.
3. Routers validate, invoke, and map; product decisions live in operations and pure rules.
4. Cross-domain operations compose explicit narrow capabilities, never recursive operation calls.
5. Each registered domain has one public `index.ts`; foreign code does not deep-import internals.
6. Notifications invalidate or reconcile server queries; Terminal streams retain their own ordered
   lifecycle and sequence semantics.
7. All expected failures are typed and public errors carry request correlation; unexpected errors
   are redacted centrally.

The only deliberate native rendering exception is
`apps/mobile/modules/porcelain-terminal`: it owns Ghostty terminal cells and input only. The
React Native Terminal feature still owns daemon/PTY transport and app chrome; this is not a general
platform-specific UI precedent.

## Versioning and runtime topology

One product version is synchronized across packages and authored skills by
`scripts/sync-versions.mjs`. The daemon is Electron-free and serves both the browser and the
renderer client. The shell owns local process lifecycle and window bindings, while tokens stay out
of the renderer. Remote listener and pairing policy is documented in
[`../remote-setup.md`](../remote-setup.md).

The daemon has one flat tRPC API and one `/session` WebSocket protocol. HTTP procedures are for
request/response state; typed notifications are recoverable freshness signals; Terminal output is
an ordered bounded stream. Reconnect restores session hello, watches, and attached Terminal
sessions because server-side session state ends with a socket.

## Client state ownership

| State | Owner |
|---|---|
| Server, Git, Files, Review, Tasks, Actions, Project Data | client-runtime definitions plus the client's query cache |
| Cross-component UI | one focused client store per concern |
| Preferences surviving reload | the persisted preferences store only |
| Local presentation state | the component |

Mutations declare targeted invalidations and foreign dependencies. A component does not mirror
server truth, and a notification is not treated as durable data. Mobile uses NativeWind v5,
Tailwind CSS v4, and React Native Reusables; Web and Electron use the Web client tree and Base UI /
shadcn primitives.

## Verification

The normal delivery gate is `pnpm verify`:

```text
lint → test → build → typecheck:e2e → typecheck:tests
```

For a changed slice, `pnpm quality:changed` answers the touched-file quality obligations first.
Operation, adapter, router, client-runtime, and feature tests own the risks at their respective
boundaries; E2E is reserved for named startup, authentication, transport, reconnect, Terminal,
and packaging risks. A passing test is evidence only when it asserts the behavior that could be
wrong.

The project intentionally closes with a clean pre-launch architecture: no speculative effect
rewrite, procedure rename, Android client, or Web/mobile UI merge. Those are product decisions, not
unfinished architecture work.
