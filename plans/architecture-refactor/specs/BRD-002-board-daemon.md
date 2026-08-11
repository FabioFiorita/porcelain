# BRD-002 — Put Board behavior behind operations and a version-1 adapter

- Status: Ready
- Batch: 1 — Board primary exemplar
- Domain: `board`
- Depends on: `BRD-001`, `DAE-001`, `TST-002`, `DAT-001`
- Governing decisions: [002](../decisions/002-organize-by-product-domain.md), [003](../decisions/003-application-operations-own-orchestration.md), [004](../decisions/004-keep-cross-domain-workflows-shallow.md), [006](../decisions/006-compose-explicit-capabilities.md), [010](../decisions/010-type-expected-failures-and-validate-boundaries.md), [011](../decisions/011-test-the-boundary-that-owns-the-risk.md), [015](../decisions/015-make-a-clean-pre-launch-cutover.md)
- Primary exemplar: yes

## Objective

All six Board procedures delegate to directly tested operations over an injected atomic Board store,
the daemon and CLI share one strict version-1 Board file model, and successful writes emit one typed
Board change fact.

## Why this unit exists

The current 60-line router and direct store are the clearest server exemplar, but the physical file
is also written directly by the dependency-free CLI. Moving only the router would leave two storage
semantics and would falsely mark Board migrated.

## Current behavior and evidence

- `apps/daemon/src/router/board.ts` parses six inputs and directly calls
  `apps/daemon/src/stores/board-store.ts`.
- The store uses `createProjectChannel`, `ensureProjectCompanion`, mutable in-place updates,
  `Date.now`, and `randomUUID`; missing card updates/moves silently succeed.
- The current file is an unversioned card array at `<project>/.porcelain/board.json`; Zod defaults
  missing fields and corrupt content becomes empty after backup through `project-channel.ts`.
- `apps/cli/src/board-file.ts` independently parses the same array permissively, defaults malformed
  fields, and writes through `project-io.ts`.
- Daemon store tests prove CRUD against a temp Project; CLI tests prove parsing/commands separately.
- Project-channel/review-watch currently turns file changes into the coarse Board app event.

## Scope

- Add `packages/shared/src/board/{board-file,index}.ts` and its package export.
- Add `apps/daemon/src/features/board/` with six operations, Board rules/capabilities, v1 JSON adapter,
  notification publisher, router, composition binder, public `index.ts`, and colocated tests.
- Change the daemon composition from `DAE-001` to bind Board operations and mount the canonical router.
- Change `apps/cli/src/board-file.ts`, its focused tests, and Board command assertions in `cli.test.ts`
  to the shared strict v1 file model while keeping the CLI dependency-free after bundling.
- Remove `apps/daemon/src/router/board.ts`, `apps/daemon/src/stores/board-store.ts`, and its old tests.
- **Reviewer resequencing (2026-08-10):** the canonical Board router in `features/board/` serves the
  six EXISTING legacy wire names (`boardCards` … `clearBoardCards`), each procedure a thin
  parse/invoke/map over its new operation. The six-for-six catalog/name swap to the BRD-001
  canonical names moves to `BRD-004`, landing atomically with the Web caller migration — otherwise
  this unit deletes procedures Web's typed tRPC hooks still reference and cannot pass its own
  `pnpm verify` gate. At every commit exactly one wire surface exists; no dual exposure, no alias.
  Wire-visible behavior changes that DO land here through the legacy names: missing-card
  update/move/delete return `board.card-not-found` instead of silent void success, and mutations
  return authoritative outputs where the legacy schema allows (create already returns the card;
  update/move/delete/clear keep their current output schemas until the swap).

## Non-goals

- Do not change Web or mobile callers; this spec lands only as part of the preplanned Board batch,
  not as an independently deployable mixed protocol.
- Do not migrate generic `project-channel.ts`, home migrations, or other domain files.
- Do not delete any existing `board.json` from disk or add an old-array reader.
- Do not make Review completion update Board; that requires an explicit Review-owned operation and
  narrow Board capability in its own spec.

## Target ownership and public surface

`@porcelain/shared/board-file` exports dependency-free `BoardFileV1`, `BoardFileCard`,
`BOARD_FILE_VERSION = 1`, `parseBoardFileV1(value): BoardFileV1`, and
`serializeBoardFileV1(value): string`. Parsing is strict and throws a typed parse error for an
incompatible version, malformed/unknown field, duplicate/non-UUID card ID, invalid status, title
outside 1–240 trimmed characters, body over 20,000 characters, negative/non-safe-integer order, or
negative/non-safe-integer creation time. Empty current state is
`{ version: 1, cards: [] }`; an absent file maps to that state in each adapter.

`apps/daemon/src/features/board/index.ts` exports only:

- the bound `boardRouter` for daemon composition;
- capability `ApplyReviewCompletionToBoard` only when an accepted Review spec supplies its exact
  atomic semantics; it is not created speculatively here.

Private Board capabilities are:

```ts
type BoardStore = {
  read(projectPath: string): Promise<BoardStoreResult<BoardFileV1>>
  transact(
    projectPath: string,
    change: (current: BoardFileV1) => BoardChangeResult,
  ): Promise<BoardStoreResult<BoardChange>>
}

type BoardClock = { now(): number }
type BoardIds = { create(): string }
type BoardChanges = { publish(change: { type: 'board.changed'; projectPath: string }): void }
```

`BoardStoreResult` distinguishes `board.unavailable` from success. `BoardChangeResult` distinguishes
`board.card-not-found` and `board.invalid-title`; no operation inspects filesystem error text. The
JSON adapter serializes read-modify-write per absolute Project path, writes temp+rename atomically,
retains size bounds and corruption backup/diagnostic, and rejects a non-v1 file without coercion.

Operations are `createListBoardCards`, `createCreateBoardCard`, `createUpdateBoardCard`,
`createMoveBoardCard`, `createDeleteBoardCard`, and `createClearBoardColumn`. Each returns the
transport-independent success/failure shape required by BRD-001. Creation injects ID/time; move uses
time for authoritative order. Mutations publish after the atomic write succeeds and never on reject
or adapter failure. List sorts by `order`, then `createdAt`, then `id` for deterministic ties.

The CLI consumes the same file parser/serializer and pure change rules from shared Board-file code;
it retains synchronous built-in filesystem I/O and existing human-readable command copy. Missing
card remains a nonzero/explicit CLI outcome, not silent success or a daemon transport call.

## Behavior to preserve

- Todo/Doing/Done columns, optional body, stable ID, creation time, and move-to-end ordering.
- Empty missing file, atomic writes, serialized same-Project updates, corruption preservation, and
  resource bounds.
- Agent CLI list/create/update/move/delete and its grouped textual rendering.
- Machine/user Project visibility policy and watcher attachment for current companion writes, but
  without calling historical home migration.
- No daemon operation writes to a user Project merely because it read an absent Board.

## Legacy behavior to delete

- Unversioned top-level array and permissive/defaulting daemon and CLI readers.
- `ensureProjectCompanion` from Board reads/writes and every Board dependency on `migrate-home.ts`.
- Silent success for missing-card update/move/delete.
- Direct router → store calls, router-local Zod schemas, old procedure names, coarse Board event
  publication from this path, and duplicate daemon/CLI Board model definitions.
- Compatibility-only tests for missing card fields or old arrays; do not delete corruption, atomic,
  concurrency, watcher, size, or CLI command proof.

## Ordered implementation

1. Create and test the strict dependency-free v1 Board file parser, serializer, and pure card-change
   rules in `packages/shared/src/board`.
2. Adapt the CLI Board file boundary and command tests to v1; prove the built bundle still has no
   runtime dependency/listener addition.
3. Define private Board capability/result types and pure title/order/card rules in the daemon slice.
4. Implement six operation factories with injected store, clock, IDs, and change publisher; add
   complete success/failure/effect-order tests using a focused in-memory `BoardStore` fake.
5. Implement the real JSON Board adapter with absent, strict-v1, incompatible, malformed, oversize,
   atomic, concurrency, and native-failure integration tests.
6. Bind operations in the daemon composition root and implement the canonical Board router as six
   parse/invoke/map-only procedures with narrow router tests.
7. Publish `board.changed` only after successful mutations and let the session notification gateway
   carry it through RT-001.
8. Keep the six legacy wire names bound to `boardLiveCatalogProcedures`; record in the feature
   router that `BRD-004` performs the six-for-six catalog swap with the Web migration.
9. Delete the old router/store/tests and prove no daemon/CLI caller imports them.

## Tests

- Pure/shared: strict v1 valid/invalid table, duplicate IDs, deterministic sorting and each card
  transition without I/O.
- Operations: six successes; invalid title; missing card for update/move/delete; empty clear;
  adapter unavailable; no transaction or notification after early rejection; exactly one
  notification after durable success; authoritative outputs.
- Adapter integration: absent state, exact v1 round-trip, incompatible/malformed/oversize diagnostic
  and preserved corrupt file, serialized concurrent mutations, temp cleanup, atomic replacement,
  permission/native-error normalization.
- Router: contract input mapping, output parsing, each expected public error, and unexpected-error
  correlation/redaction through the shared boundary.
- CLI: every Board verb reads/writes the same v1 fixture as the daemon adapter and rejects old arrays
  clearly; no network/listener behavior.

## Validation and evidence

Run the exact focused commands established by `TST-002`, then:

```bash
pnpm --dir apps/desktop exec vitest run ../../packages/shared/src/board ../daemon/src/features/board ../cli/src/board-file.test.ts ../cli/src/cli.test.ts
node scripts/lint-procedure-contracts.mjs
node scripts/lint-architecture.mjs
pnpm build:cli
pnpm build:daemon
pnpm lint
pnpm verify
git diff --check
```

Search proof:

```bash
rg -n "stores/board-store|router/board|ensureProjectCompanion" apps/daemon/src apps/cli/src
rg -n "z\.array\(boardCardSchema\)|status.*default\('todo'\)" apps/daemon/src apps/cli/src
```

The first search has no Board runtime hits after this unit; the second finds no legacy permissive
storage schema. (The legacy wire-name search moves to `BRD-004`/`BRD-005` with the swap.) Inspect a temp fixture, not real companion data, to show exact v1 JSON.

## Forbidden shortcuts

- No old-array reader, dual write, automatic conversion, silent reset, or deletion of existing disk
  data.
- No operation-to-operation call, concrete adapter import in an operation, service locator, or
  router orchestration.
- No generic operation fake in operation tests and no fake that reimplements rules; use a focused
  BoardStore state/capability fake. Router mapping may use TST-002's deferred operation stub.
- No notification before persistence, `Date.now`/`randomUUID` hidden inside operations, mutation of
  shared in-memory objects, or native error-string matching above the adapter.
- No Zod/runtime package added to the CLI bundle.

## Completion criteria

- [ ] Six canonical procedures invoke six directly tested operations.
- [ ] Daemon and CLI accept/write only the shared strict v1 Board file shape.
- [ ] Expected failures and authoritative mutation results match BRD-001.
- [ ] Atomicity, concurrency, corruption, size, visibility, and CLI constraints remain proved.
- [ ] Successful writes emit one typed fact; rejects/failures emit none.
- [ ] Old Board router/store files and permissive schemas have no daemon/CLI runtime path; the six
      legacy wire names survive only as thin bindings over the new operations until `BRD-004`.
- [ ] No existing real Board data was deleted or rewritten during implementation/proof.
- [ ] Focused tests, builds, repository lint, full verify, diff check, and searches pass.
- [ ] One commit lands only `BRD-002`, marks recipe/catalog Landed, leaves a clean worktree,
      provides the README review packet, and finishes without pushing.

## Handoff

`BRD-003` may bind shared client semantics to exact canonical procedures and `board.changed`.
`BRD-004` and `BRD-005` may assume authoritative mutation outputs and strict v1 behavior; after all
three land, `BRD-005` removes remaining client legacy and marks Board complete.
