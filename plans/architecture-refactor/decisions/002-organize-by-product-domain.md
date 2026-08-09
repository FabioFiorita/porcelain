# 002 — Organize by product domain

- **Status:** Accepted
- **Accepted:** 2026-08-08

## Context

Porcelain's runtime packages provide valuable deployment and dependency boundaries, but code inside
them is frequently organized first by technical role: routers, components, hooks, stores, schemas,
or utilities. A developer tracing one capability must search across broad horizontal directories
and learn which accidental arrangement that capability uses. Learning Files does not reliably
teach the path through Review, Board, Git, Terminal, or another capability.

A single repository-wide feature tree would make domains visually adjacent but weaken the real
runtime boundaries between the daemon, browser, Electron shell, mobile application, and shared
packages. Conversely, keeping only horizontal technical layers makes ownership and navigation
implicit.

## Decision

Runtime packages remain the hard physical boundaries; within each package, product domains are the
primary unit of ownership, navigation, and colocation.

## Rules

Use the same canonical domain name anywhere that domain appears:

```text
packages/contracts/src/files/
apps/daemon/src/features/files/
packages/client-runtime/src/files/
apps/web/src/features/files/
apps/mobile/src/features/files/
```

The example describes a navigation rule, not a requirement that every domain exist in every
package or that each directory have the same internal shape.

- A product domain is the first organizational question. Route, component, hook, schema, store,
  service, repository, and test are roles inside an owner, not repository-wide owners themselves.
- Feature-specific code is colocated with its domain, including its tests and private helpers.
- Each domain exposes a narrow public entry point. Other domains import that surface rather than
  reaching into arbitrary internals.
- Domain names and important concepts use one vocabulary across contracts, daemon, shared client
  behavior, Web, mobile, documentation, and tests.
- Directories are earned by multiple concrete responsibilities. Empty or one-file ceremonial
  `controllers/`, `services/`, `repositories/`, `use-cases/`, or similar trees are forbidden.
- A package may retain technical infrastructure directories for capabilities that are genuinely
  cross-domain: transport setup, authentication, persistence drivers, Git or filesystem adapters,
  logging, and generic UI primitives.
- Code does not become shared merely because two callers exist. It moves to a shared package only
  when it represents one coherent responsibility that the shared package is intended to own.
- A workflow spanning domains must have one explicit owner. The collaboration mechanism and
  dependency direction are governed by later decisions, not improvised during folder migration.

Canonical names and the initial domain inventory will be settled before migration specifications
are delegated. Synonyms such as `review` and `feature`, or `repository` and `project`, cannot be
normalized incidentally by an execution agent because they may affect persisted or wire behavior.

## Responsibilities by package

The repeated domain noun provides a trail, while package responsibility explains what belongs at
each stop:

- `packages/contracts` owns the domain's public wire vocabulary.
- `apps/daemon` owns the domain's server-side behavior and host-capability coordination.
- `packages/client-runtime` owns nonvisual behavior genuinely shared by multiple clients.
- `apps/web` owns Web presentation and Web-only interaction behavior.
- `apps/mobile` owns mobile presentation and mobile-only interaction behavior.
- `apps/desktop` contains a domain only when native shell integration is required; product business
  logic remains outside Electron.
- `apps/cli` may expose domain commands while remaining a dependency-light agent channel.

These statements establish navigation and ownership, not the detailed internal layering of each
package. Later decisions define application operations, adapters, state, realtime behavior, and
cross-domain collaboration.

## Rationale

- A developer can begin every investigation with a product noun and follow it through runtime
  boundaries.
- Colocation makes the complete impact of a feature change easier to inspect and delete.
- Package boundaries continue to express executable topology and prevent browser/server coupling.
- The model allows Web and mobile to differ in presentation without inventing different domain
  vocabularies or duplicating shared nonvisual behavior.
- Avoiding mandatory layer directories preserves clarity for small domains while allowing complex
  domains to earn internal structure.

## Rejected alternatives

- **One repository-wide `features/` tree.** It obscures deployment boundaries and encourages
  cross-runtime imports even though a domain spans separate programs.
- **Global horizontal layers.** Broad `routers/`, `services/`, `hooks/`, `stores/`, and
  `components/` directories optimize for implementation mechanism rather than product discovery.
- **Identical trees in every package.** Clients and servers have different responsibilities;
  visual symmetry would manufacture empty layers and false abstractions.
- **Framework vocabulary as the primary map.** Controllers, services, repositories, and use cases
  can be useful roles, but none answers which product capability owns a behavior.
- **Share after the second use.** Caller count alone does not establish a stable abstraction or the
  correct package owner.

## Consequences

- Existing horizontal directories will coexist temporarily with migrated domain slices.
- Migration specifications must move one bounded responsibility at a time and forbid unrelated
  cleanup of neighboring domains.
- Import boundaries and package export maps should eventually enforce narrow domain entry points.
- Some cross-cutting modules must be examined carefully: a technical name can hide product policy,
  while a domain-named helper can actually be infrastructure.
- The migration inventory must map current terms to canonical domains before agents move files.
- The final architecture will be consistent in navigation and dependency direction, not
  mechanically identical in file count or nesting.

## Enforcement and proof

Architecture checks should eventually reject cross-domain deep imports and imports that violate
runtime package direction. Package exports and local entry points should make the intended public
surface the easiest path.

Each migration must prove that a developer can trace its domain from public contract or entry point
through the owning behavior and client presentation without searching global role directories. A
new generic directory or shared abstraction requires an identified owner and more justification
than reducing duplicate lines.
