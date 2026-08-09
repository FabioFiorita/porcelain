# 003 — Application operations own orchestration

- **Status:** Accepted
- **Accepted:** 2026-08-08

## Context

Daemon behavior currently appears in routers, helpers, stores, technical modules, and direct host
capability calls. Some procedures are thin while others contain complete workflows. This makes a
public procedure's real behavior difficult to predict and gives tests no consistent seam below the
transport.

Putting orchestration in a controller or router can make one request readable, but it binds the
workflow to tRPC. Reuse from another procedure, the CLI, a background reaction, or a direct test
then duplicates the workflow or reaches through transport code. Conversely, allowing services or
use cases to call each other creates a hidden execution graph that requires opening multiple files
to understand one intention.

## Decision

Every public daemon procedure delegates to one application operation that owns the complete
orchestration for that user or agent intention.

The governing model is:

```text
router translates
    ↓
application operation orchestrates
    ↓
domain rules decide + capability ports describe effects
    ↓
adapters perform I/O
```

“Application operation” is Porcelain's architectural term. “Use case” is an acceptable explanatory
synonym, but code uses operation names based on the intention, such as `writeFile`, `completeReview`,
or `createWorktree`.

## Responsibilities

### Router

A router procedure may:

- expose the public tRPC procedure;
- apply authentication and session context;
- parse the public contract;
- construct the operation input from transport context;
- invoke exactly one application operation;
- translate the operation result or failure into the public transport shape.

A router does not contain business decisions, coordinate multiple capabilities, own transactions,
or reproduce part of the workflow before or after the operation.

### Application operation

An application operation:

- represents one complete user or agent intention;
- makes the workflow readable in one place;
- coordinates every required domain rule and capability;
- owns the workflow's consistency or transaction boundary;
- returns a transport-independent result;
- is directly testable without constructing a tRPC caller or opening real host resources.

Operations are functions by default. A class must be justified by meaningful lifecycle or retained
state, not by framework convention.

An operation does not call another application operation. If two operations need the same behavior,
that behavior must have an explicit lower-level owner: a pure domain policy, a domain capability,
or an infrastructure capability. Cross-domain ownership is refined by the next decision.

### Domain rules

Domain rules express decisions and invariants without performing I/O. They may be simple functions,
value types, or cohesive policies. A domain does not need an entity or policy layer when it has no
meaningful business rule to express.

### Capability ports and adapters

Operations depend on named capabilities that describe required effects. Adapters implement those
capabilities using the filesystem, Git, project stores, database, PTY, operating system, or external
tools. The exact construction and injection mechanism is a later decision.

## Shape

Every procedure has an operation, including a simple read. The abstraction may remain a small
colocated function; consistency does not require directory ceremony.

```text
apps/daemon/src/features/files/
├── files.router.ts
├── list-files.ts
├── read-file.ts
├── write-file.ts
├── files-policy.ts       # only when domain decisions exist
├── files-ports.ts        # only when domain-specific effects exist
└── index.ts
```

Subdirectories such as `operations/`, `domain/`, or `adapters/` are introduced only when the domain
has enough files and responsibilities to benefit from them. The architectural role must remain
clear from names and dependencies whether or not a subdirectory exists.

## Example

```text
files.write procedure
    ↓ exactly one call
writeFile operation
    ├── evaluate workspace and path policy
    ├── write through the filesystem capability
    ├── update related owned state when required
    └── return the application result
```

Whether the resulting change produces a realtime event, and which layer publishes it, remains a
separate realtime decision. It must not be improvised while migrating the operation.

## Rationale

- Every public intention has the same trace and direct test seam.
- The workflow remains independent of tRPC and can be reused by another authorized entry point.
- One operation provides the clean orchestration overview sought from a controller without making
  transport the business owner.
- Explicit capabilities reveal side effects and make unit tests useful without mocking internal
  implementation details.
- Small functions preserve consistency without imposing enterprise-style class hierarchies.

## Rejected alternatives

- **Orchestrate in routers/controllers.** This couples application behavior to tRPC and encourages
  duplicated workflows across entry points.
- **Let services call services.** Arbitrary nesting hides the execution graph and makes ownership
  dependent on implementation history.
- **Let operations call operations.** A reusable public workflow is not automatically a safe
  internal primitive; composition this way creates the same hidden graph under a different name.
- **Require classes and interfaces for every use case.** Function boundaries and structural types
  provide the seam without lifecycle-free objects or boilerplate.
- **Skip operations for simple reads.** This restores inconsistent tracing and encourages business
  behavior to accumulate in the router as the read grows.
- **Require a full Clean Architecture directory tree.** Architectural responsibility matters; empty
  symmetry does not.

## Consequences

- Thick routers must be extracted incrementally into operations.
- Thin routers that currently call stores or host APIs directly gain small operations.
- Existing helpers need classification as a domain rule, capability, adapter, or accidental
  fragment of an operation.
- Operation tests become the principal fast seam for workflow behavior; the complete testing
  strategy remains a later decision.
- Transport schemas, errors, events, and dependency construction remain governed by their own
  decisions so this boundary does not silently settle them.

## Enforcement and proof

Architecture checks should eventually prevent routers from importing concrete host adapters or
domain internals outside their feature entry point. A router test may prove transport behavior, but
it cannot substitute for direct operation tests.

Each migrated procedure must identify its single operation and show that the complete workflow can
be understood and tested there. Any additional orchestration in the router, or any operation calling
another operation, fails the migration unless an accepted decision defines a narrow exception.
