# Migration order and review gates

The refactor lands as domain-atomic cutovers built on a small foundation. This order prevents an
executor from inventing compatibility or a second architecture merely because a downstream seam is
not ready yet.

## Dependency sequence

```text
active guidance + registry + shrink-only gate
    ↓
contract catalog + public errors + protocol/realtime categories
    ↓
daemon composition + operation/adapter test seams + versioned storage primitives
    ↓
client-runtime definitions + contract-valid client mock
    ↓
Board end-to-end exemplar
    ↓
Review comments optimism · Files realtime · Git host mutation · Terminal stream exemplars
    ↓
remaining domain-atomic cutovers
    ↓
Project Data clean root and explicitly authorized reset/export
    ↓
Review vocabulary/Evidence clean cutover
    ↓
Ship/Audit retirement + Companion narrowing
    ↓
empty-v1 launch proof and removal of every migration ledger entry
```

Protocol, public-error, and storage foundations introduce target primitives without pretending a
legacy domain is migrated. A domain becomes `complete` in the machine registry only in its final
cross-package cutover spec, after old callers and aliases are gone.

## Primary-agent exemplars

The architecture author lands and reviews these first. Later executors copy their concrete shape.

| Exemplar | Risk demonstrated | Why this domain |
| --- | --- | --- |
| Architecture foundation | Registry, package graph, ratchet, current docs | Makes new debt harder before moving behavior |
| Board | Simple reads, CRUD mutations, v1 JSON adapter, notifications, Web/mobile | Smallest complete domain with both clients |
| Review comments | Reversible optimism and authoritative reconciliation | Existing Web behavior and matching mobile surface |
| Files | Host capability, expected native failures, watches, reconnect recovery | Proves realtime without treating events as commands |
| Git checkout/add-worktree | Multi-query non-optimistic host mutation | Proves different consequences for similar intentions |
| Terminal | Stateful bidirectional stream and reattachment | Proves the deliberate exception to request/query state |

“Exemplar” does not permit folding adjacent domain cleanup into the commit. It means the resulting
files and tests are the reference implementation for later recipes.

## Parallelism

Parallel execution is allowed only when specs share no current file and depend only on landed work.
The catalog assigns batches; specs in one batch are not automatically parallel-safe. Contract
catalog composition, daemon composition, client-runtime exports, architecture registries, package
exports, and docs indexes are serial ownership points.

Every executor stops if a listed dependency is absent or its current paths no longer match. The
architecture reviewer rebases the spec against current truth rather than asking the executor to
guess.

## Domain cutover gate

Before a domain status changes to `complete`, one review must prove:

1. canonical contract procedures, outputs, errors, and notifications are exhaustive;
2. every public router delegates to exactly one directly tested operation;
3. cross-domain collaborators are narrow public capabilities and the graph is acyclic;
4. real adapters retain the named security, resource, atomicity, and native-error invariants;
5. Web/mobile/CLI use contracts and client-runtime semantics rather than local wire mirrors;
6. query ownership, mutation consequences, optimism, watches, and streams are explicit;
7. version-1 clean state and corrupt/incompatible diagnostics are proved where data persists;
8. every named alias, migration, dual path, old schema, and compatibility-only test is deleted;
9. the architecture ledger shrinks and no new waiver was added;
10. focused tests and required runtime evidence pass before the bounded commit.

## Human-data gate

No architecture executor deletes real companion data. The Project Data reset/export specification
remains blocked until it enumerates exact roots, classifies material versus disposable state, states
backup/export behavior, and receives any authorization needed for destructive external data. Code
may stop reading an obsolete pre-launch format after its accepted cutover; it may not silently erase
the files.

## Final launch gate

The launch candidate begins from empty or explicit version-1 seed data and proves matching and
mismatched protocol behavior. Repository searches find no pre-launch migrations, deprecated wire
fields, local schema mirrors, Feature/Project aliases at product boundaries, mandatory Companion
session lifecycle, Ship/Audit references, or completed-domain legacy ledger entries. `pnpm verify`
and the named critical E2E wiring suite pass from a clean checkout.
