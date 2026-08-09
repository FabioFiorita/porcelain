# Target contributor architecture

This is the integrated target model for the refactor. Accepted decisions remain the source of
rationale; this document is the concrete recipe a contributor follows. It moves to `docs/` only as
the corresponding paths, examples, and gates become current truth.

## Trace one intention

Start from a product noun in the [domain registry](domain-registry.md), then follow the same trail:

```text
contract input/output/error
    ↓
domain router: authenticate, parse, invoke one operation, map result
    ↓
application operation: the complete intention and effect ordering
    ↓
pure domain rules + narrow capability ports
    ↓
composition-injected adapters: filesystem, Git, store, PTY, network, process
    ↓
typed change fact after a successful state change
    ↓
client-runtime query/mutation/notification/stream semantics
    ↓
Web or mobile feature adapter
    ↓
component and local interaction state
```

A simple read follows the same trace. Consistency is the seam, not directory ceremony.

## Runtime packages stay hard boundaries

| Package | Owns | May depend on |
| --- | --- | --- |
| `packages/contracts` | Exhaustive runtime-validated wire vocabulary | Zod and dependency-light schema support |
| `packages/shared` | Pure behavior genuinely shared across server and clients | No application package |
| `apps/daemon` | Server operations, domain rules, capabilities, adapters, and composition | contracts, shared |
| `packages/client-runtime` | Nonvisual semantics shared by Web and mobile | contracts, shared |
| `apps/web` | Browser presentation, Web adapters, and Web-only interaction | contracts, shared, client-runtime |
| `apps/mobile` | Native presentation, mobile adapters, and mobile-only interaction | contracts, shared, client-runtime |
| `apps/desktop` | Thin Electron shell and native integration | contracts/shared only where integration requires them |
| `apps/cli` | Dependency-light agent channel | contracts/shared where required |

Applications never import another application's source. Contracts do not import application or
persistence models. Desktop owns no product business logic.

## Contract slice

Each completed domain owns an exhaustive contract entry point:

```text
packages/contracts/src/board/
├── board.contract.ts       # serializable public models and schemas
├── board.procedures.ts     # procedure input/output/error declarations
├── board.notifications.ts  # typed change facts exposed to clients
├── board.fixtures.ts       # contract-valid test fixtures, when earned
└── index.ts
```

Names, inputs, outputs, expected public errors, notifications, and protocol version are all runtime
validated. There is no `unknown` fallback for a completed procedure, no client-local mirror, and no
daemon type crossing the wire. Internal domain, persistence, and presentation models stay internal
and map explicitly at their boundary.

## Daemon slice

Small domains stay flat. Directories appear only after several files make the roles harder to see:

```text
apps/daemon/src/features/board/
├── board.router.ts
├── list-board-cards.ts
├── create-board-card.ts
├── update-board-card.ts
├── board-store.ts          # capability type, or split when implementations multiply
├── json-board-store.ts     # concrete adapter
├── board-notifications.ts
├── board-fixtures.ts       # test builders, only if reused
├── *.test.ts
└── index.ts                # narrow domain surface
```

The router performs transport work only and invokes exactly one operation. The operation is a
function by default, owns the complete workflow, depends on capability-shaped arguments, and never
calls another operation. Pure rules do no I/O. Concrete adapters are constructed only in the daemon
composition root.

An operation returns a discriminated result for expected failures. Adapters normalize native
failures to capability meaning. Unexpected defects reach one centralized daemon boundary that logs
internal detail once and returns the safe contract error with a request ID.

## Cross-domain workflow

The domain representing the user intention owns one coordinating operation:

```ts
type CompleteReviewDependencies = {
  reviews: CompleteStoredReview
  git: ReadProjectGitState
  board: ApplyReviewCompletionToBoard
}
```

The exact names are chosen by the owning spec. The important shape is visible, shallow, and
acyclic: `operation → domain capability → rules/adapters`. A foreign capability protects its own
domain but does not call more domains. Mandatory work is awaited explicitly; notifications never
hide required state changes.

## Composition and persistence

One daemon composition root constructs concrete host adapters and binds operations. Routers receive
already-bound operations. There is no service locator, decorator container, process-global mutable
registry, or infrastructure singleton imported from domain code.

Each persisted format has one owner, an explicit version-1 schema, atomic write behavior, and an
explicit corruption policy. Public contracts are not reused as persistence schemas by default.
Completed domains have one read/write path: no dual reads, dual writes, migration discovery, or old
shape coercion. A protocol mismatch and incompatible stored version fail with a clear diagnostic.
Resilience for real runtime conditions remains.

## Client slice

Client-runtime owns shared server-state semantics, not React components or platform APIs:

```text
packages/client-runtime/src/board/
├── board-queries.ts
├── board-mutations.ts
├── board-notifications.ts
├── board-reconciliation.ts   # only if shared behavior exists
├── *.test.ts
└── index.ts
```

- TanStack Query owns daemon truth.
- Client-runtime names typed query identities, mutation consequences, optional optimism,
  reconciliation, notification effects, and session/stream state machines.
- Web/mobile adapters add endpoint identity and bind those definitions to their TanStack Query and
  transport APIs.
- Domain stores contain only drafts, selections, or multi-component presentation workflows; they do
  not mirror query data.
- Components own small local interactions and never select procedure names, cache keys,
  invalidations, or transport retry behavior.
- Optimism is opt-in, reversible, and reconciled with authoritative results. Git, filesystem,
  process, and other unpredictable host effects are not optimistically claimed.

The client-runtime package never imports React, React Native, DOM, browser storage, Secure Store,
WebSocket implementations, or application source.

## Realtime categories

One authenticated session socket carries three different categories without conflating them:

| Category | Meaning | Recovery |
| --- | --- | --- |
| Change notification | A typed fact that daemon-owned state changed | Map exhaustively to query identities; invalidate/refetch |
| Declarative watch | Client interest in bounded host paths or domain scopes | Deduplicate, replay after reconnect, refresh if coverage may have been missed |
| Stateful stream | Ordered bidirectional state such as Terminal | Correlate, attach, track sequence/epoch, restore or report loss honestly |

Notifications are not business commands. They publish only after successful effects and may trigger
refresh, never mandatory hidden work.

## Test ownership

| Boundary | Required proof |
| --- | --- |
| Domain rule | Decisions, calculations, invariants |
| Operation | Complete intention, result/state, expected failures, effect ordering |
| Adapter integration | Real filesystem/Git/store/process/platform representation and cleanup |
| Contract | Valid/invalid input, output, event, and public-error shapes plus exhaustiveness |
| Router | Authentication, mapping, output validation, centralized safe error translation |
| Client-runtime | Query identities, mutation consequences, optimism, notification maps, state machines |
| Web/mobile feature | Visible behavior against contract-valid daemon mocks |
| E2E | Only critical assembled startup/auth/transport/reconnect/Terminal/runtime wiring |

Tests are assigned to the lowest boundary that completely owns the risk. Fakes implement capability
shapes without reproducing business rules. Client mocks validate configured requests and responses
through contracts without reimplementing the daemon. Every bug gains the smallest regression test
at the boundary that owned it.

## Mechanical enforcement

The migration foundation owns one machine-readable registry and gate that eventually proves:

- canonical domain keys and target paths;
- runtime package dependency direction;
- no cross-domain deep imports in completed slices;
- router → operation → capability/adaptor direction;
- exhaustive procedures, public errors, and notifications;
- no local wire-schema mirrors in completed clients;
- file-size ceilings and banned generic containers;
- one storage/protocol version and no completed-domain legacy names;
- exact migrated-domain status and shrink-only legacy baselines.

Legacy is recorded by exact path or count and may only shrink. A migration spec removes its entries;
an agent never expands an allowlist to make a gate pass. Human review retains responsibility for
whether an owner or abstraction is conceptually honest.

## Definition of a completed domain cutover

A domain is complete only when all participating packages use its canonical vocabulary and target
boundary, every public wire shape is exhaustive, every caller uses the target path, named legacy is
deleted, tests own the meaningful risks, clean version-1 state works, resilience remains proved, and
the architecture gate has no waiver for that domain. “New path exists” is not completion while the
old path remains callable.

## Concrete exemplar sequence

Board is the first complete worked example. Its recipes turn the model above into five bounded,
ordered commits:

1. [`BRD-001`](specs/BRD-001-board-contracts.md) defines strict contracts, failures, and the typed
   change fact.
2. [`BRD-002`](specs/BRD-002-board-daemon.md) implements operations over an injected version-1
   store and makes the router a transport adapter.
3. [`BRD-003`](specs/BRD-003.md) defines framework-neutral query, mutation,
   optimism, and notification consequences.
4. [`BRD-004`](specs/BRD-004.md) binds those semantics to Web while keeping presentation
   local.
5. [`BRD-005`](specs/BRD-005.md) completes mobile/CLI adoption, deletes the
   old representations, and closes the architecture ledger.

These are executable specifications, not illustrative pseudocode. Later domain recipes copy their
ownership and proof pattern while preserving their own behavior; they do not copy Board-specific
types or abstractions.
