# Domain architecture

Porcelain's domain-first architecture is landed. The codebase has ten canonical product domains;
the old architecture-refactor plans and their execution machinery are gone. This page is the
current source for ownership, dependency direction, state ownership, and proof expectations.

## Ten canonical domains

Use the same key in contracts, daemon, client-runtime, Web, mobile, tests, and target paths:

```text
projects · files · git · search · review
board · actions · terminal · project-data · remote
```

Shell, Viewer, Settings, UI, daemon composition, Desktop, native integration, infrastructure, and
Quick Open are supporting regions, not extra product domains. Settings assembles controls; it does
not own the behavior behind them. Quick Open composes existing domain queries and navigation; it
does not create a second search or command domain.

Current product language is authoritative: Review replaces the old `feature` vocabulary; Project
replaces repo/workspace ownership; Changes and History are Git surfaces; Comments are Review; saved
commands are Actions rather than Terminal. Do not add compatibility names when extending a slice.

## One path from wire to UI

```text
contracts procedure catalog
        ↓
canonical daemon feature router
        ↓
application operation — one complete intention
        ↓
pure rules + narrow capability ports
        ↓
composition-injected adapters
        ↓
typed notification or ordered stream consequence
        ↓
client-runtime query/mutation/realtime semantics
        ↓
Web or mobile feature adapter and presentation
```

Every public procedure has one operation, including simple reads. A router authenticates, parses,
invokes that operation, and maps its declared result; it contains no product decisions. Operations
own intention and orchestration. They do not call other operations recursively. Cross-domain work
uses explicit narrow capabilities from the participating domains, so required work cannot be hidden
behind an event.

The daemon composition root is the only place that assembles the flat tRPC router. The contracts
package owns strict, runtime-validated wire shapes and the exact procedure catalog; it never
imports an application. Daemon code never imports clients. Client-runtime owns shared nonvisual
query, mutation, notification, error, and session semantics without importing React, DOM, browser,
or native APIs. Web and mobile adapt those semantics to their own transport and UI primitives.

## Repository boundaries

Each registered domain root has one narrow `index.ts` public boundary. Import another domain through
that boundary; do not deep-import its internals. The canonical domain paths are:

| Layer | Path | Owns |
|---|---|---|
| Wire | `packages/contracts/src/<domain>` | schemas, procedure definitions, errors, notifications |
| Server | `apps/daemon/src/features/<domain>` | router, operation, rules, ports, adapters, stores |
| Shared client | `packages/client-runtime/src/<domain>` | query keys, mutation effects, freshness, recovery |
| Web | `apps/web/src/features/<domain>` | browser transport adapter and presentation |
| Mobile | `apps/mobile/src/features/<domain>` | native transport adapter and presentation |

Supporting-region aliases are intentional and registered: mobile Comments belongs to Review, and
mobile Quick Open belongs to the supporting surface layer. They are not permission to invent another
domain tree.

The dependency direction is:

```text
desktop → daemon, web, contracts, shared
web     → client-runtime, contracts, shared
mobile  → client-runtime, contracts, shared
daemon  → contracts, shared
cli     → shared
contracts → nothing under apps/
client-runtime → contracts
shared → no product package
```

There is one version-1 wire and storage path. Do not retain historical aliases, dual reads/writes,
or old-shape fallbacks. Reconnect, corruption, resource, security, and platform resilience are
real behavior and remain typed rather than being treated as compatibility migration.

## State, errors, and realtime

- Server truth lives in client-runtime query definitions and the owning client query cache. A
  component does not mirror server data in a second store.
- Mutations declare targeted invalidations and foreign dependencies. A blanket invalidation is
  reserved for commands whose effects genuinely span the whole working tree.
- Notifications are typed freshness signals: they invalidate or reconcile the affected query
  family. They are recoverable hints, not a second source of truth.
- Terminal output is different: it is an ordered, bounded stream with sequence/lifecycle rules;
  it is not modeled as a cache invalidation event.
- Expected failures are typed at the operation/adapter boundary, validated at the router, and
  mapped to the public error contract with request correlation. Unexpected errors are centralized,
  redacted, and never leak host paths or secrets.
- Each client state has one owner: query cache for daemon state, a focused store for cross-component
  UI state, persisted preferences only for preferences, and local component state otherwise.

## Proof at the owning boundary

Use the smallest test that completely owns the risk:

| Boundary | Proof |
|---|---|
| Contract | schema/procedure tests, exact input/output catalog |
| Pure rule | deterministic unit tests |
| Adapter | filesystem, Git, storage, process, or platform integration tests |
| Operation | orchestration, failure, and notification tests |
| Router | one-operation binding, contract serialization, public error mapping |
| Client-runtime | query/mutation/realtime/session semantics |
| Web/mobile feature | hook/transport mocks and user-facing behavior |
| Assembled startup/transport/Terminal/package risk | named E2E lane only |

A test must be able to fail: no skipped tests, tautologies, empty assertion bodies, or assertions
that merely observe a mock call. After changing code, run `pnpm quality:changed`; then run the
required gate (`pnpm verify` for a complete implementation unit). Runtime evidence scales with the
risk, but “implemented, should work” is never proof.

## Permanent enforcement

The live registry is `scripts/architecture/domains.mjs`; all ten domains are complete, with empty
legacy ledgers and no deep-import debt. The gates that protect this architecture are:

- `lint-architecture`: domain paths, package direction, public indexes, file-size ceiling, and
  shrink-only raw-import baselines;
- `lint-procedure-contracts`: the contract procedures and canonical daemon routes match
  one-to-one;
- `lint-escapes`, `lint-security-boundaries`, and the mobile NativeWind/file-size gates;
- `lint-docs`, `lint-skill-commands`, `typecheck:tests`, and the repository quality gates.

If a rule is objective and enforceable, update the gate. If it is judgment about ownership or
design, keep the explanation here and in the owning domain code. New work starts from this landed
architecture; there is no migration ledger or recipe queue to advance.
