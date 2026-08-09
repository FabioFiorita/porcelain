# 001 — Preserve the product topology

- **Status:** Accepted
- **Accepted:** 2026-08-08

## Context

Porcelain already has strong product-scale boundaries: a headless daemon owns machine capabilities;
Web and mobile are clients of that daemon; Electron is a thin native shell; the CLI is the agent
channel; contracts and pure shared packages prevent runtime coupling. Local and remote operation use
the same daemon path.

The architectural pain is primarily *inside* those boundaries. Feature behavior is inconsistently
split across routers, technical modules, stores, hooks, components, local client schemas, and manual
event invalidation. Replacing the package topology or transport would multiply migration risk while
leaving feature ownership and discoverability unresolved.

## Decision

Refactor Porcelain's internal feature architecture without replacing its product topology,
transports, or frameworks.

## Rules

Retain these product surfaces and package responsibilities:

```text
apps/daemon   machine capabilities, server behavior, authenticated HTTP/WS
apps/cli      dependency-light agent channel
apps/web      browser and Electron-loaded React client
apps/desktop  Electron-native shell and packaging only
apps/mobile   separate React Native client of the same daemon

packages/contracts       client/server wire vocabulary
packages/client-runtime  nonvisual behavior genuinely shared by clients
packages/shared          pure cross-cutting helpers
packages/ui              shared design tokens
```

The refactor must also preserve these foundations unless a later accepted decision explicitly and
narrowly supersedes one:

- the daemon owns Git, filesystem, PTY, project data, and other host capabilities;
- Web and mobile reach those capabilities through the daemon, locally and remotely;
- Electron remains free of product business logic;
- tRPC remains the request/response transport;
- the authenticated WebSocket protocol remains the realtime and session transport;
- React Query and Zustand are not replaced for architectural aesthetics;
- existing public procedure names remain stable unless a separately justified compatibility
  decision changes one;
- migrations preserve product behavior unless their specification names and proves a bug fix.

Structural movement is allowed within and between the retained packages when later decisions assign
clearer ownership. Preserving topology does not freeze today's files, type locations, duplicated
client logic, or router composition.

## Rationale

- Package and runtime separation is one of Porcelain's strongest existing properties.
- Incremental domain migration is possible while the product keeps shipping.
- The problems under investigation are discoverability, inconsistent application orchestration,
  incomplete shared contracts, duplicated client behavior, and unclear feature recipes.
- T3 Code demonstrates the value of a cross-surface domain spine, but its Effect and event-sourced
  machinery addresses substantially different orchestration needs.
- A framework or transport rewrite would consume the program before it established the developer
  model the program exists to create.

## Rejected alternatives

- **Adopt NestJS or another server framework.** Dependency injection and naming do not themselves
  establish Porcelain's domain ownership, and the migration would replace working transport and
  runtime foundations.
- **Adopt Clean Architecture wholesale.** Its dependency principles remain useful inputs, but a
  mandatory entity/use-case/interface-adapter/framework directory stack would introduce ceremony
  before Porcelain has decided which boundaries actually need substitution.
- **Adopt Effect or event sourcing from T3 Code.** Porcelain does not currently need replayable
  agent-session orchestration to make Files, Review, Board, or Git flows predictable.
- **Merge clients or move business logic into Electron.** Both would undo the local/remote single
  path and multi-surface architecture already proven by the product.
- **Rewrite first, standardize afterward.** That would require executors to make the architectural
  decisions this program exists to settle centrally.

## Consequences

- This is a major incremental refactor, not a rewrite.
- Later decisions must define a canonical domain spine inside the retained topology.
- Temporary coexistence between legacy and target feature shapes is expected and must be bounded by
  migration specifications.
- A migration cannot justify a second transport, client-only backend, or new state framework merely
  because it makes one domain easier in isolation.
- Framework replacement and product behavior changes remain separate proposals with their own
  evidence, never incidental cleanup inside architecture migration specs.

## Enforcement and proof

Existing dependency gates that keep Electron out of daemon/Web and keep Web components away from
raw tRPC remain in force. Later enforcement may strengthen domain dependencies, contract coverage,
and client-runtime ownership, but it must operate within this accepted topology.

Every migration specification must include “preserve product topology” as a governing decision and
identify any touched public wire behavior. A spec that requires a new framework, transport, or
product surface returns to architectural discussion rather than delegating that choice to its
executor.
