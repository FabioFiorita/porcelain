# 008 — Give each client state one owner

- **Status:** Accepted
- **Accepted:** 2026-08-09

## Context

React provides several ways to hold and synchronize values, while TanStack Query and Zustand add
specialized ownership models. Without explicit rules, daemon data can be copied into component or
store state, derived values can be synchronized through effects, and each mutation caller can
invalidate a different collection of queries. Web and mobile then implement the same product
consequences separately.

Avoiding `useState`, `useEffect`, or `useRef` categorically does not eliminate state. It often moves
small local interactions into global stores or hides synchronization in custom abstractions. The
architecture should minimize these primitives by assigning each kind of state one authoritative
owner and using effects only at real external boundaries.

## Decision

TanStack Query owns daemon/server truth; navigation owns shareable location; domain-scoped client
stores own cross-component presentation workflows; components own small local interactions; and
client-runtime owns the shared semantic definitions for queries, mutations, optimism, and affected
data.

## State taxonomy

| State kind | Authoritative owner |
|---|---|
| Daemon or server data | TanStack Query cache |
| Shareable navigation state | Router, URL, or navigation parameters |
| Cross-component presentation workflow | Domain-scoped Zustand store |
| Small component-local interaction | `useState` or `useReducer` |
| Persisted client preference | Explicit preference store and storage adapter |
| Derived value | Computed from authoritative state |
| Imperative handle or non-rendering mutable value | `useRef` |
| External-system synchronization | Narrow `useEffect` at the boundary |

Rules follow from that ownership:

- Daemon data is not copied into Zustand or component state.
- Derived values are computed, not synchronized through effects or redundant setters.
- `useEffect` does not implement a business workflow or indirectly respond to an action that can be
  handled at the action or mutation boundary.
- `useRef` does not hide a value whose change should render UI.
- Complex local transitions use a reducer or explicit state machine rather than interdependent
  booleans and effects.
- Draft ownership follows its required lifetime: local interaction, cross-component feature
  workflow, or explicit persisted preference.
- Zustand stores live with their product domain. A repository-wide `stores/` directory is not the
  primary owner.

## Query model

The canonical read flow is:

```text
component
    ↓
app feature hook
    ↓
client-runtime query definition
    ↓
app TanStack Query and transport adapter
    ↓
daemon contract
```

Client-runtime owns the query's product semantics:

- canonical typed query identity;
- contract procedure and input relationship;
- stable key construction rules;
- product-level pure transformations;
- shared freshness semantics when they genuinely apply to every client.

The app adapter owns active daemon or environment selection, React integration, transport mechanics,
and platform-specific foreground or background behavior. Components use feature hooks and do not
import raw tRPC, daemon clients, or query-client mechanics.

Query keys include daemon or environment identity, typed domain query identity, and normalized input
where applicable. This prevents data from one daemon or parameter set appearing under another.

## Mutation model

Each domain mutation has one semantic definition in client-runtime that may declare:

- its contract procedure;
- precisely affected typed query identities;
- an optional pure optimistic transition;
- the snapshot or inverse information required for rollback;
- reconciliation from the authoritative server result;
- whether an authoritative refetch remains necessary.

App feature hooks adapt that definition to TanStack Query. Components invoke the feature hook; they
do not choose cache keys, duplicate mutation consequences, or call transport clients directly.

A client does not coordinate several daemon mutations to implement one business intention. When
correctness requires several server-side steps, the daemon exposes one application operation and one
public procedure. Client sequencing remains appropriate only for independent presentation actions
whose partial completion is truthful and intentional.

## Optimistic updates

Optimism is used only when the expected transition is deterministic, rollback is safe, immediate
feedback materially improves the interaction, and concurrent server changes can be reconciled.

The standard lifecycle is:

```text
cancel affected queries
    ↓
snapshot relevant cache state
    ↓
apply a pure optimistic transition
    ↓
perform the mutation
    ├── failure → restore the snapshot
    └── success → reconcile the authoritative result
    ↓
invalidate only if authoritative refetching is still required
```

Optimistic transitions and rollback logic live as pure tested behavior in client-runtime. App hooks
apply the lifecycle through their query adapter.

Optimism is normally rejected when an operation performs unpredictable Git, filesystem, process,
network, or external-tool effects; when the server assigns values the client cannot predict; or when
rollback would imply that an irreversible effect did not happen. An explicit pending state is more
honest in those cases.

## Invalidation

Mutations and realtime events refer to shared typed query identities, not scattered procedure-name
strings or app-specific cache calls. Each app adapter maps those semantic identities to its concrete
TanStack Query keys.

- Mutation consequences live beside the mutation definition.
- Event consequences use the same query identities; event delivery is the next decision.
- A successful mutation updates cache directly when its result is sufficient and invalidates only
  data that still requires authoritative refetching.
- Broad invalidation is reserved for a genuine global reset, such as changing environment or
  reconnecting to a replaced daemon process.
- Invalidating a domain does not mean invalidating every query owned by the application.
- Components and screens never contain ad hoc invalidation lists.

## Presentation state

Domain Zustand stores contain only client-owned workflow state that must outlive or coordinate
several components. Store actions express meaningful transitions rather than exposing setters for
every field. Server responses are referenced through query state rather than duplicated into the
store.

Small interaction state remains local. Using `useState` for whether one menu is open is clearer than
creating a global store. `useReducer` or a state machine is preferred when several values transition
together. `useEffect` is reserved for synchronizing with something outside React, such as a socket,
native listener, document API, or timer, and that synchronization should usually be centralized in
an adapter or provider rather than repeated by feature components.

## Rationale

- One owner eliminates synchronization loops and contradictory copies.
- Shared query and mutation semantics keep Web and mobile behavior aligned without sharing UI hooks.
- Typed query identities replace stringly typed invalidation lists.
- Pure optimistic transitions can be tested without rendering React.
- Server-side workflows retain their transactional and failure semantics.
- React primitives remain available for the narrow jobs they model well instead of becoming
  architectural taboos.

## Rejected alternatives

- **Ban React state primitives.** Local state moves into broader, less appropriate owners.
- **Store daemon data in Zustand.** Two caches must be synchronized and can disagree.
- **Derive state through effects.** Rendering becomes dependent on asynchronous synchronization and
  intermediate stale values.
- **Let each component invalidate queries.** Mutation meaning varies by caller and client.
- **Optimistically update every mutation.** The UI claims success for effects it cannot predict or
  safely reverse.
- **Always invalidate after mutation success.** Useful authoritative mutation results are discarded
  and unnecessary network work hides incomplete cache modeling.
- **Have the client call several mutations for one server workflow.** Correctness, partial failure,
  and ordering escape the owning daemon operation.
- **Use raw procedure-name strings as cache identities.** Renames and input distinctions become
  runtime-only bugs.

## Consequences

- Existing Web and mobile invalidation lists must migrate to shared typed query identities.
- Server data currently mirrored into stores or local state must return to the query cache.
- Global store files must move to their owning domains or be recognized as truly app-wide shell
  state.
- Feature hooks become thin adapters and the only normal query/mutation entry point for components.
- Optimistic behavior will be added selectively, not as a migration completeness requirement for
  every mutation.
- The first mutation exemplar must demonstrate result reconciliation, exact invalidation, rollback,
  and an honest non-optimistic alternative.

## Enforcement and proof

Existing component import rules should expand to prevent raw transport and query-client access from
presentation components. Static checks can reject global store placement, string invalidation lists,
and direct server-data storage in known Zustand patterns where detection is reliable.

Each migrated client flow must identify every state value's owner, use the shared query or mutation
definition, and prove equivalent semantic consequences in Web and mobile adapters. Optimistic flows
require pure transition and rollback tests; non-optimistic flows must expose pending and failure
states without inventing local server truth.
