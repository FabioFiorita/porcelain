# Architecture

This is the current runtime map. It describes ownership and seams that exist in the repository;
it is not a proposal for future product architecture.

## Runtime

Porcelain has one daemon and several clients:

```text
browser ─┐
Electron ├─> daemon ─> filesystem, Git, terminals, persistence, sharing
mobile  ─┘
agent channel ───────> daemon capabilities
```

The daemon is a headless Node process with HTTP procedures and a `/session` WebSocket for live
updates and terminal streams. The browser client is served by the daemon. Electron hosts the same
web client and owns local process/window lifecycle. Mobile is an active native client using the
same daemon and shared contracts. The current agent channel is the companion CLI/skill boundary.

## Packages

```text
apps/daemon   daemon runtime and server
apps/web      React/Vite client
apps/desktop  Electron host and local-daemon lifecycle
apps/mobile   Expo/React Native client
apps/cli      dependency-light agent/host command line

packages/contracts       cross-client wire schemas and procedure types
packages/client-runtime  shared client queries, mutations, session, and semantics
packages/shared          low-level cross-cutting utilities
packages/ui              shared UI primitives and tokens
```

The normal dependency direction is clients → `client-runtime`/`contracts`/`shared`, daemon →
`contracts`/`shared`, and contracts → nothing under `apps`. Keep new dependencies local to the
package that owns the behavior until a second consumer makes sharing useful.

## Ownership

- The daemon owns filesystem access, Git, worktrees, terminals, development servers, remote
  listeners, pairing, persistence, and product procedures.
- `packages/contracts` owns data exchanged across process boundaries. A contract change must be
  checked against every active client.
- `packages/client-runtime` owns reusable client transport/query/session behavior; a component
  should not reach into transport internals directly.
- Web owns browser/Electron presentation. Desktop stays a thin host rather than a second business
  logic implementation.
- Mobile owns native lifecycle and presentation. Its terminal module may render native terminal
  cells, while daemon/PTY transport remains client feature code.
- The agent channel adapts semantic daemon operations for agents. It should not become a second
  store or duplicate product rules.

## Data boundaries

The daemon's `PORCELAIN_HOME` is the default home for private project data, credentials, Canvas and
Action data, and daemon-wide Tasks. A repository-local `.porcelain/` is optional and only holds
data explicitly promoted into Git. The client owns presentation state such as tabs, splits, pins,
and preferences. A connected Hub may show several daemons, but each daemon remains authoritative
for its own state.

Development and production are separate environments. The development launcher sets
`PORCELAIN_DEV`, uses disposable playgrounds, and keeps agent work away from production homes and
real checkouts. See [development.md](development.md) and [remote-access.md](remote-access.md) for
the operational details.

## Change guidance

When a change crosses a boundary, name the owner before editing. Prefer one vertical slice through
the existing seam over a new abstraction. Add a shared package only when the behavior is genuinely
shared by more than one active consumer. Update this map when runtime ownership or package topology
actually changes; do not use it as a backlog or a justification for speculative layers.
