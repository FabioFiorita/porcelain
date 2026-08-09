# Architecture refactor

**Decision program.** Started 2026-08-08. The objective is that a developer who learns one
Porcelain feature can trace and change the next through the same explicit boundaries, vocabulary,
state ownership, and testing seams without relying on agent memory.

This directory is the durable memory for the program. Conversation discovers the architecture;
accepted decisions here govern it. Nothing in this plan describes the current product merely
because we intend it to become true.

## Phases

1. **Decide.** Discuss one architectural question at a time. Record it only after the human accepts
   it. A later decision may explicitly supersede an earlier one; silent contradiction is forbidden.
2. **Design the migration.** Inventory every affected domain against the complete decision set,
   order dependencies, and write bounded specifications under `specs/`.
3. **Establish examples.** The primary architecture agent implements and proves the first several
   representative migrations: simple read, mutation, multi-step operation, realtime flow, and
   cross-client flow.
4. **Scale execution.** Execution agents follow accepted decisions, specifications, and landed
   examples. They do not make new architecture. The primary agent reviews each batch for drift.
5. **Retire the plan.** As target rules become true, distill lasting contributor guidance into
   `docs/`, `AGENTS.md`, or mechanical gates. Delete completed specifications and decisions once
   their useful truth lives in the shipped architecture; Git remains the archive.

## Decision format

Every file under `decisions/` records:

- status and acceptance date;
- context and the exact problem;
- the decision in one sentence;
- concrete rules and boundaries;
- rationale and rejected alternatives;
- consequences and migration implications;
- enforcement opportunities;
- examples, counterexamples, and explicit exceptions when they add clarity.

Decision numbers express dependency order, not importance. Proposed decisions do not govern work.
Accepted decisions do. Superseded decisions must link to their replacement.

## Specification format

Every execution specification must remove architectural judgment from the executor. It includes:

- objective and governing accepted decisions;
- current behavior that must survive;
- exact scope, non-goals, and dependent specifications;
- target ownership, paths, types, and public APIs;
- ordered implementation steps;
- tests, validation commands, and required evidence;
- forbidden shortcuts and completion criteria;
- follow-ups that must not be smuggled into the unit.

Specifications stay small enough for one agent to execute and one reviewer to understand. A spec
that contains an unresolved product or architecture choice returns to the decision phase.

## Accepted decisions

1. [`001-preserve-product-topology.md`](decisions/001-preserve-product-topology.md) — refactor
   inside Porcelain's existing product topology and transports; this is not a rewrite.
2. [`002-organize-by-product-domain.md`](decisions/002-organize-by-product-domain.md) — keep runtime
   packages as hard boundaries and use product domains as the shared navigation spine within them.
3. [`003-application-operations-own-orchestration.md`](decisions/003-application-operations-own-orchestration.md)
   — routers translate, application operations orchestrate, domain rules decide, and adapters
   perform I/O.
4. [`004-keep-cross-domain-workflows-shallow.md`](decisions/004-keep-cross-domain-workflows-shallow.md)
   — one operation visibly coordinates narrow domain-owned capabilities without recursive
   orchestration or event-hidden requirements.
5. [`005-contracts-own-the-wire.md`](decisions/005-contracts-own-the-wire.md) — contracts provide
   the exhaustive runtime-validated wire specification and canonical public vocabulary without
   owning internal application, domain, persistence, or presentation models.
6. [`006-compose-explicit-capabilities.md`](decisions/006-compose-explicit-capabilities.md) — one
   composition root injects capability-shaped dependencies into operations, while domains own
   persistence semantics and declare honest consistency boundaries.
7. [`007-share-nonvisual-client-behavior.md`](decisions/007-share-nonvisual-client-behavior.md) —
   client-runtime owns cross-client application semantics, while Web and mobile adapt them to their
   UI frameworks, transports, and platforms.
8. [`008-give-each-client-state-one-owner.md`](decisions/008-give-each-client-state-one-owner.md) —
   TanStack Query owns server truth, domain stores own shared client workflows, components own small
   interactions, and client-runtime owns query and mutation semantics.
9. [`009-treat-realtime-as-recoverable-signals-and-streams.md`](decisions/009-treat-realtime-as-recoverable-signals-and-streams.md)
   — typed change notifications, declarative watches, and stateful streams share one socket while
   retaining distinct semantics and honest recovery guarantees.
10. [`010-type-expected-failures-and-validate-boundaries.md`](decisions/010-type-expected-failures-and-validate-boundaries.md)
    — each boundary validates its own concern, expected failures remain typed, and one safe public
    error model connects daemon failures to client recovery.
11. [`011-test-the-boundary-that-owns-the-risk.md`](decisions/011-test-the-boundary-that-owns-the-risk.md)
    — operation tests form the server regression backbone, clients mock the public contract, real
    adapters prove external behavior, and E2E stays a small wiring suite.

## Decision queue

Only the first unresolved item is discussed at a time. The order may change when a decision exposes
a dependency.

1. Define naming, file-size, dependency, and architecture enforcement.
2. Inventory domains, order migrations, and author execution specifications.

## Inputs considered

The decisions are derived from Porcelain's actual constraints. Historical reference projects
(`ignite-nodejs-03-api-solid-nodejs` and `pizzashop-web`) and T3 Code provide comparison points, not
templates. NestJS, Clean Architecture, use-case classes, mocks, Effect, and event sourcing remain
options to evaluate only where they solve a demonstrated Porcelain problem.
