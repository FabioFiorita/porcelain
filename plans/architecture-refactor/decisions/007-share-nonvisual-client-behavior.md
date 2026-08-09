# 007 — Share nonvisual client behavior

- **Status:** Accepted
- **Accepted:** 2026-08-08

## Context

Porcelain's Web and mobile clients communicate with the same daemon and implement many of the same
product concepts, but their shared behavior currently has no complete architectural owner.
`packages/client-runtime` contains useful pure utilities and session protocol pieces, while mobile
owns a substantial daemon/query layer and Web relies on its tRPC React Query integration. Realtime
invalidation rules are maintained separately, and some Web modules only re-export client-runtime
functions.

Sharing React hooks wholesale would force Web and mobile into the same transport and lifecycle
details even where their environments differ. Leaving every behavior in the apps duplicates product
semantics and lets Files, Review, or Git mean different things on each surface.

## Decision

`packages/client-runtime` is Porcelain's shared nonvisual client application layer; it owns product
semantics that must remain consistent across clients, while Web and mobile adapt those semantics to
their UI frameworks, transport environments, navigation, and platform capabilities.

The dependency direction is:

```text
packages/contracts
        ↓
packages/client-runtime
        ↓
apps/web          apps/mobile
```

Client-runtime does not import either application. Contracts do not import client-runtime.

## Client-runtime ownership

When the behavior is genuinely common across clients, client-runtime may own:

- validated daemon procedure descriptors and transport-independent invocation behavior;
- session protocol, connection, and reconnection state machines;
- domain query identities and cache-key definitions;
- event-to-stale-data relationships;
- mutation consequences and pure optimistic state transitions;
- pure client-side product transformations, reducers, and policies;
- shared interpretation, formatting, or disposition with product meaning;
- platform capability types needed by otherwise shared behavior;
- unit tests for those shared semantics.

The next client-state and realtime decisions define the exact query, mutation, optimism, and event
shapes. This decision assigns ownership without prematurely selecting their detailed API.

Client-runtime remains organized by product domain when behavior belongs to one:

```text
packages/client-runtime/src/files/
├── files-queries.ts
├── files-mutations.ts
├── files-events.ts
├── files-state.ts
└── index.ts
```

Those names are illustrative. Small domains keep cohesive code together instead of creating empty
symmetry.

## Application ownership

Web and mobile own:

- visual components, screens, and application-specific hooks;
- DOM, React Native, Electron, and navigation integration;
- dialogs, sheets, focus, keyboard bindings, and responsive layout;
- platform-specific session discovery, storage, and capability implementations;
- framework adapters for tRPC and TanStack Query;
- presentation state such as open panels, active tabs, selections, and transient drafts;
- client-specific accessibility and interaction behavior.

Their feature hooks should be thin adapters over shared semantic definitions where those definitions
exist. The hooks may differ because Web and mobile have different transport, focus, backgrounding,
and navigation environments; they must not redefine the product meaning of a query or mutation.

## Ownership test

Code belongs in client-runtime when all of these are true:

1. It expresses product behavior that should be identical across clients.
2. It can execute without React DOM, React Native, Electron, or application navigation.
3. It has one coherent semantic contract rather than merely similar implementations.

Caller count alone is insufficient. Behavior used by one client today may belong in client-runtime
when the product explicitly requires the other client to adopt the same semantics. Conversely, two
similar presentation helpers remain in their apps when platform behavior is the real owner.

Pure code shared across server and clients belongs in `packages/shared`, not client-runtime. Shared
visual tokens belong in `packages/ui`; shared wire vocabulary belongs in `packages/contracts`.

## Imports and entry points

- Client-runtime exposes narrow domain or capability subpaths.
- Applications import those stable subpaths directly.
- App-local files that only re-export client-runtime symbols are removed unless they provide a real
  compatibility boundary or app-specific adaptation.
- Apps cannot deep-import client-runtime internals.
- Client-runtime cannot depend on browser globals, native modules, Electron APIs, or app stores.
- Platform effects needed by shared behavior are expressed as injected capabilities and implemented
  by each app.

## Illustrative flow

```text
contract schema and procedure name
              ↓
client-runtime Files query/mutation semantics
          ↙                         ↘
Web query/hook adapter       mobile query/hook adapter
          ↓                         ↓
Web components                 mobile components
```

The two adapters may use different mechanics but consume the same definitions for concepts such as
query identity, affected data, optimistic transitions, and event consequences.

## Rationale

- Product behavior is implemented and tested once without forcing presentation parity.
- Contracts remain wire-focused instead of accumulating client application policy.
- Web and mobile can honor different platform lifecycles while using one domain vocabulary.
- A developer tracing a client feature has a predictable semantic layer between contracts and UI.
- Pure shared behavior provides a stable, fast unit-test seam.
- Direct subpath imports remove app-local re-export files that add navigation without ownership.

## Rejected alternatives

- **Keep all behavior in each app.** Shared daemon semantics, invalidation, and transformations drift.
- **Share React hooks directly by default.** Transport, lifecycle, navigation, and platform concerns
  become coupled even when only the underlying product semantics are shared.
- **Move every duplicate into client-runtime.** Similar code is not necessarily one responsibility.
- **Put client behavior in contracts.** Wire schemas would own state transitions and application
  policy outside their boundary.
- **Use client-runtime as a generic utilities package.** Product ownership disappears into an
  unstructured helper collection.
- **Add local re-export wrappers for every shared function.** A reader must follow another file that
  contributes no adaptation or policy.
- **Unify Web and mobile presentation architecture.** Shared behavior does not require identical
  screens, navigation, or interaction models.

## Consequences

- Existing helpers must be classified as shared client behavior, cross-runtime pure behavior, or
  app-owned presentation behavior.
- Mobile's daemon/query layer and Web's tRPC hooks need semantic extraction without forcing one
  transport implementation.
- Duplicate realtime invalidation maps should converge on shared consequences, while each app keeps
  the mechanism that applies them.
- Some client-runtime utilities should move under domain subpaths; broad moves wait for the domain
  inventory and bounded specifications.
- The first cross-client exemplar must establish the shared-definition and thin-adapter pattern
  before execution agents repeat it.

## Enforcement and proof

Package dependency rules should keep client-runtime free of app, React DOM, React Native, Electron,
and navigation imports. Export maps should expose intended subpaths and prevent deep imports.

Each migrated cross-client behavior must show one semantic definition and test in client-runtime,
thin adapters in each participating app, and platform-specific behavior remaining with its app. A
shared extraction fails when it introduces UI/runtime dependencies or when the apps still maintain
parallel definitions of the same product rule.
