# 004 — Keep cross-domain workflows shallow

- **Status:** Accepted
- **Accepted:** 2026-08-08

## Context

An application operation sometimes needs behavior owned by several product domains. Allowing it to
reach into another domain's store or adapter breaks that domain's invariants. Calling another public
operation protects ownership but creates recursive orchestration: the complete workflow becomes a
graph that can only be understood by opening operations, services, and handlers transitively.

Events can decouple modules mechanically, but they also hide required work and failure behavior. A
workflow that publishes an event to complete a mandatory step is not understandable from its owning
operation and may report success before the intention is fulfilled.

## Decision

One top-level application operation owns and visibly coordinates the complete workflow through
narrow, domain-owned capabilities; cross-domain capabilities do not recursively orchestrate other
domains, and required work is not hidden behind events.

## Workflow ownership

- The domain representing the user or agent intention owns the coordinating operation.
- The operation's name describes the complete intention, not its first technical step.
- If no existing domain naturally owns the intention, introduce an explicitly named workflow domain
  rather than assigning it to an arbitrary service or infrastructure module.
- There is one application-level orchestration layer for a workflow.
- The coordinating operation's dependency type makes every required collaborator visible.

```text
completeReview operation
    ├── ReviewStore.complete(...)
    ├── ProjectGit.readStatus(...)
    └── BoardCompletion.markReviewDone(...)
```

The exact names above are illustrative. The domain inventory and later migration specifications
choose canonical names without changing public or persisted vocabulary incidentally.

## Domain capabilities

A domain exposes narrow commands or queries through its public entry point when another domain has
a legitimate need for its behavior.

A domain capability:

- names one cohesive ability, such as reading Git status or applying a Board completion;
- protects the providing domain's rules and data ownership;
- may invoke that domain's pure rules and infrastructure adapters;
- returns an explicit result or failure to the coordinator;
- does not call another domain capability or application operation;
- does not expose the providing domain's repository, filesystem layout, or private helpers.

Calling such a capability is not recursive application orchestration. The coordinator shows *why*
the ability participates in the workflow; the capability encapsulates *how its owning domain safely
performs that atomic command or query*.

Generic grab-bag services such as `projectService`, `reviewService`, or `sharedService` are not
domain capabilities. A collaborator's name and type must reveal the specific ability being used.

## Dependency rules

- The permitted application graph is `operation → domain capabilities → domain rules/adapters`.
- The prohibited graph is `operation → operation → service → service/event handler → adapter`.
- A domain imports another domain only through that domain's public entry point.
- Cross-domain deep imports and direct access to another domain's persistence or adapters are
  forbidden.
- Circular domain dependencies are forbidden. A cycle indicates misplaced workflow ownership, a
  missing lower-level concept, or domains that should be reconsidered.
- Capability interfaces and their construction must remain explicit. The later dependency-injection
  decision determines their exact ownership and wiring pattern.

## Synchronous work and events

If a step must succeed for the operation to truthfully report success, the coordinator invokes it
explicitly and awaits its result.

Events are reserved for reactions where eventual completion is acceptable, such as telemetry,
nonessential activity reporting, cache notification, or presentation refresh. They do not perform
mandatory state transitions, enforce invariants, or conceal partial failure.

The later realtime decision defines publication and delivery mechanics. This decision establishes
only that realtime transport and domain events cannot replace visible required orchestration.

## Rationale

- The complete workflow can be understood from one operation.
- Domains protect their own invariants instead of exposing storage details.
- Collaborator names reveal effects without forcing a reader to inspect each implementation.
- A shallow graph avoids the service-to-service nesting that makes behavior unpredictable.
- Synchronous requirements have explicit ordering and failure semantics.
- Optional reactions may remain decoupled without weakening correctness.

## Rejected alternatives

- **Operations call operations.** Public intentions become internal building blocks and recreate a
  recursive service graph under another name.
- **The coordinator accesses every repository directly.** This centralizes the visible workflow by
  discarding domain ownership and invariant enforcement.
- **Domain services call other domain services.** The workflow becomes dependent on transitive
  implementation details and cycles become likely.
- **Publish events for required steps.** Success, ordering, retries, and partial failure become
  implicit and difficult to test.
- **Put every multi-domain workflow in a global orchestration service.** This produces a new
  grab-bag owner disconnected from product intentions.
- **Duplicate the foreign domain's behavior locally.** The rule and its future changes acquire
  multiple owners.

## Consequences

- Existing nested helper and service chains must be flattened into the owning operation.
- Cross-domain direct store access must be replaced by narrow public capabilities.
- Some current events may need reclassification as required synchronous work or truly optional
  reactions.
- A capability can have multiple callers, but its responsibility remains atomic and domain-owned.
- Transaction construction, retries, and compensation require later persistence and error decisions;
  executors cannot invent them during migration.
- Explicit workflow domains should be rare and named after a real product intention, not used as a
  generic escape hatch.

## Enforcement and proof

Import rules should eventually prevent cross-domain deep imports, domain cycles, operation-to-
operation imports, and concrete foreign-adapter access. Static checks should prefer public domain
entry points and declared dependency types over naming heuristics alone.

Each migrated cross-domain workflow must show:

- its single coordinating operation;
- all required collaborators in that operation's dependency type;
- required ordering and failure behavior in the operation body;
- domain-owned capabilities for foreign behavior;
- no mandatory behavior delegated to an event;
- no application-level call depth below the coordinator.
