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

## Decision queue

Only the first unresolved item is discussed at a time. The order may change when a decision exposes
a dependency.

1. Define cross-domain collaboration without hidden service graphs.
2. Make contracts and public domain vocabulary authoritative across clients.
3. Define infrastructure adapters, persistence ownership, and dependency injection.
4. Define the shared client-runtime boundary and Web/mobile responsibilities.
5. Define client state ownership, mutations, optimism, and invalidation.
6. Define realtime events, subscriptions, and refresh ownership.
7. Define errors and validation across domain and transport boundaries.
8. Define test responsibilities by boundary and risk.
9. Define naming, file-size, dependency, and architecture enforcement.
10. Inventory domains, order migrations, and author execution specifications.

## Inputs considered

The decisions are derived from Porcelain's actual constraints. Historical reference projects
(`ignite-nodejs-03-api-solid-nodejs` and `pizzashop-web`) and T3 Code provide comparison points, not
templates. NestJS, Clean Architecture, use-case classes, mocks, Effect, and event sourcing remain
options to evaluate only where they solve a demonstrated Porcelain problem.
