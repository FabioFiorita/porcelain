# BRD-001 — Define the canonical Board wire

- Status: Draft
- Batch: 1 — Board primary exemplar
- Domain: `board`
- Depends on: `CON-021`, `ERR-001`, `RT-001`
- Governing decisions: [002](../decisions/002-organize-by-product-domain.md), [005](../decisions/005-contracts-own-the-wire.md), [009](../decisions/009-treat-realtime-as-recoverable-signals-and-streams.md), [010](../decisions/010-type-expected-failures-and-validate-boundaries.md), [015](../decisions/015-make-a-clean-pre-launch-cutover.md)
- Primary exemplar: yes

## Objective

Board has one exhaustive canonical contract for six intentions and one change notification, with no
legacy procedure name or client-authored wire schema remaining after the Board batch completes.

## Why this unit exists

Board is the smallest domain spanning daemon, CLI, Web, mobile, persisted state, and realtime. Its
contract must land before the operation and client exemplars can compile against one vocabulary.

## Current behavior and evidence

- `packages/contracts/src/procedures/names.ts` lists `boardCards`, `addBoardCard`,
  `updateBoardCard`, `moveBoardCard`, `deleteBoardCard`, and `clearBoardCards`.
- `packages/contracts/src/procedures/refined.ts` defines their current schemas and
  `boardCardSchema`; five mutation outputs are `void` except create.
- `packages/contracts/src/ws-protocol.ts` exposes the coarse `app-event: board` discriminator.
- `apps/daemon/src/router/board.ts` authors duplicate Zod inputs and returns daemon store types.
- `apps/mobile/src/lib/daemon/procedures/review.ts` mirrors the Board card and all six procedures.
- Web imports `BoardCard` and `CardStatus` from `@backend/stores/board-store`.
- Current card fields are `id`, `title`, optional `body`, `status`, `order`, and `createdAt`.

## Scope

- Replace the current-name definitions in
  `packages/contracts/src/board/{board.contract,board.procedures,index}.ts` with the canonical Board
  surface and extend RT-001's `board.notifications.ts` without defining a second notification.
- Add `packages/contracts/src/board/board.errors.ts` and compose its strict members through
  `packages/contracts/src/errors/public-errors.ts`.
- Add `board.fixtures.ts` and colocated contract tests under `packages/contracts/src/board/`.
- Compose the modules through the catalog/export surface introduced by `CON-001` and `RT-001`.
- Update only catalog and package exports needed to expose the Board contract.

## Non-goals

- Do not change the daemon router, clients, CLI, or persisted `board.json` in this unit.
- Do not temporarily expose both canonical and old Board procedures from a running router.
- Do not define TanStack Query keys or optimistic behavior in contracts.

## Target ownership and public surface

`@porcelain/contracts/board` exports:

- `BOARD_STATUSES = ['todo', 'doing', 'done'] as const`, `BoardStatus`;
- strict `boardCardSchema` and inferred `BoardCard` with required `id`, `title`, `status`, `order`,
  `createdAt` and optional `body`;
- `listBoardCards(projectPath: string) -> BoardCard[]`;
- `createBoardCard({ projectPath, title, body?, status? }) -> BoardCard`;
- `updateBoardCard({ projectPath, cardId, title?, body? }) -> BoardCard`;
- `moveBoardCard({ projectPath, cardId, status }) -> BoardCard`;
- `deleteBoardCard({ projectPath, cardId }) -> { cardId: string }`;
- `clearBoardColumn({ projectPath, status }) -> { status: BoardStatus; cardIds: string[] }`;
- RT-001's `boardChangedSchema` for `{ type: 'board.changed'; projectPath: string }`;
- fixture functions `boardCardFixture` and `boardNotificationFixture` returning schema-valid values.

Inputs require `projectPath` of 1–4096 characters, UUID card IDs, trimmed titles of 1–240
characters, bodies of at most 20,000 characters, nonnegative safe-integer `order`, and nonnegative
safe-integer `createdAt`. Update input uses a refinement requiring at least `title` or `body`.
Every procedure declares `board.unavailable` with no details. Card-specific mutations additionally
declare `board.card-not-found` with required `{ cardId: UUID }`; title-bearing mutations declare
`board.invalid-title` with required `{ reason: 'blank' | 'too-long'; maxLength: 240 }`. All three are
strict `board.errors.ts` members composed into ERR-001's discriminated public-error union.

The old names are removed from the contract catalog only in the atomic daemon/caller cutover. This
file introduces canonical definitions first but does not create aliases mapping old names to new.

## Behavior to preserve

- Three ordered Board columns and optional card body.
- Server-generated card identity and timestamps.
- Create may omit status and intentionally defaults to `todo` in the operation, not in the wire
  output schema.
- The notification remains a refresh signal; it does not carry a command or claim durable delivery.

## Legacy behavior to delete

The Board batch deletes the six old procedure names, the `app-event: board` member, Board definitions
inside horizontal `procedures/refined.ts`, mobile Review-local schemas/descriptors, and Web daemon
store type imports. This unit records those deletions but does not leave the repository half-wired by
performing them before `BRD-002` through `BRD-005` are ready.

## Ordered implementation

1. Define strict card/status/input/output schemas and inferred types in `board.contract.ts`.
2. Define the three exact Board public-error members, compose them into the global error union, and
   register all six canonical procedure declarations with their allowed codes in
   `board.procedures.ts` using the `CON-001` API.
3. Reuse RT-001's registered `board.changed` schema and add its Board fixture without changing the
   notification name or envelope.
4. Add deterministic contract-valid fixtures without daemon business logic.
5. Export only the Board public boundary from `board/index.ts` and the package export map.
6. Compose Board declarations into the exhaustive global catalogs while old runtime names remain
   classified as legacy, not aliased.
7. Add contract tests before allowing `BRD-002` to consume the definitions.

## Tests

- Accept a complete card and reject missing/defaulted output fields, invalid status, negative or
  nonfinite order/time, blank title/path/id, unknown keys, and update-with-no-fields.
- Parse every fixture through its schema.
- Prove each procedure input/output and allowed error-code declaration is cataloged exactly once.
- Prove `board.changed` is a notification and cannot parse as watch or stream traffic.
- Do not test Board CRUD business behavior here.

## Validation and evidence

Run:

```bash
pnpm exec vitest run packages/contracts/src/board
node scripts/lint-procedure-contracts.mjs
node scripts/lint-architecture.mjs
pnpm lint
```

Before the final Board cutover, `rg -n "boardCards|addBoardCard|clearBoardCards|app-event.*board"`
must still identify the legacy callers named above. After `BRD-005`, the same search must return no
runtime compatibility path.

## Forbidden shortcuts

- No `z.unknown()`, passthrough object, `void` mutation output, daemon type import, or local client
  schema.
- No old-name aliases, procedure-name translation table, dual event discriminator, or defaulted wire
  output.
- No persistence envelope or UI view model in contracts.

## Completion criteria

- [ ] Six exact canonical declarations and one typed notification exist under `contracts/src/board`.
- [ ] Inputs, outputs, public errors, and fixtures are runtime validated and exhaustive.
- [ ] Package exports expose the Board boundary without exposing private catalog internals.
- [ ] Contract tests and all listed gates pass.
- [ ] The handoff names every legacy deletion owned by the remaining Board specs.

## Handoff

`BRD-002` may import canonical Board inputs/results/errors/notification; `BRD-003` may define shared
client semantics against them. Neither may recreate Board wire types.
