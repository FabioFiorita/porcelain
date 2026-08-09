# 010 — Type expected failures and validate boundaries

- **Status:** Accepted
- **Accepted:** 2026-08-09

## Context

Porcelain receives untrusted data over tRPC and WebSocket, reads mutable host resources, invokes Git
and processes, and serves independently updated clients. A single validation pass cannot prove all
of those boundaries. Structural wire validity, application permission, domain invariants, persisted
state, and native adapter outcomes are different concerns.

Exceptions are useful for defects and truly unexpected failures, but ordinary outcomes such as not
found, conflict, invalid transition, or known command refusal are part of application behavior. If
those outcomes exist only as thrown classes or message strings, TypeScript cannot show callers what
they must handle and clients cannot present stable recovery actions.

## Decision

Each trust boundary validates the concern it owns; expected application and capability failures are
typed discriminated results, unexpected defects remain exceptions, and one contract-owned public
error model carries safe machine-readable failures to every client.

## Validation responsibilities

```text
untrusted request
    ↓ contract structure
application operation
    ↓ intention and current-state permission
domain rules
    ↓ invariants
capability adapter
    ↓ external representation and native outcomes
external resource
```

- Contract schemas validate serialized structure, required fields, types, bounds, discriminators,
  identifiers, and wire formats.
- Application operations validate whether the requested intention is permitted in current state.
- Domain rules enforce product invariants without I/O.
- Adapters validate and normalize filesystem, Git, persistence, process, and external-tool data at
  the point those representations enter Porcelain.
- Public output schemas validate that the daemon still honors its response contract.
- Client-side form validation provides early feedback but never replaces daemon validation.
- Persistence schemas are owned by persistence adapters, not automatically by public contracts.

Data is parsed once at each genuine trust boundary. Internal modules do not repeatedly parse values
merely to signal caution, and a boundary does not assume a TypeScript type proves external data.

## Expected failures

An operation or capability represents expected failures in a discriminated return type:

```ts
type CompleteReviewResult =
  | { ok: true; value: CompletedReview }
  | {
      ok: false
      error:
        | { code: 'review.not-found'; reviewId: string }
        | { code: 'review.already-complete'; reviewId: string }
        | { code: 'git.working-tree-conflict'; paths: string[] }
    }
```

Expected failures include known not-found, conflict, invalid-state, failed-precondition, policy,
permission, unsupported-operation, resource-unavailable, and external-command outcomes that callers
can meaningfully handle.

- Operation return types enumerate their expected application failures.
- Capability types enumerate expected external or persistence failures relevant to their callers.
- Domain decisions return typed rejections when rejection is part of normal behavior.
- Pure functions that cannot meaningfully fail return ordinary values; `Result` is not required for
  every helper.
- Coordinating operations translate lower-level failure meaning only when the application intention
  requires a different public concept.
- Callers use exhaustive discrimination on error codes rather than message matching.

## Adapter normalization

Adapters translate native representation into capability meaning:

```text
native ENOENT
    ↓ WorkspaceFiles adapter
{ code: 'files.not-found', path }
```

Application and domain code do not inspect native error messages, platform-dependent exit text,
database error strings, or error classes from concrete dependencies. Adapter failures retain an
internal cause for diagnostics where safe, but that cause never becomes a public payload directly.

Unknown adapter exceptions remain unexpected defects. They are not guessed into a convenient domain
failure that could mislead recovery behavior.

## Unexpected defects

Programming bugs, broken internal invariants, impossible state, and exceptions outside a declared
capability failure model travel to one centralized daemon error boundary.

That boundary:

- assigns or preserves a correlation request ID;
- logs the original exception once with useful internal context;
- redacts credentials, environment values, unsafe host paths, and sensitive content;
- returns a safe public internal error;
- never exposes a stack trace or concrete server error class;
- does not relabel every defect as a business failure.

Expected failures are not automatically server-error logs. Logging level and detail reflect their
operational value rather than the fact that an operation returned `ok: false`.

## Public error contract

`packages/contracts` owns the common envelope and the discriminated details for public codes:

```ts
type PorcelainError = {
  code: PublicErrorCode
  category:
    | 'invalid-request'
    | 'unauthenticated'
    | 'forbidden'
    | 'not-found'
    | 'conflict'
    | 'unavailable'
    | 'internal'
  message: string
  retryable: boolean
  requestId: string
  details?: PublicErrorDetails
}
```

- `code` is stable and machine-readable, using canonical names such as `review.not-found`.
- `category` supports generic transport and presentation handling.
- `message` is safe fallback copy, never a parsing API.
- `retryable` is an intentional statement, not inferred from HTTP status alone.
- `requestId` connects public failure reports to daemon diagnostics.
- `details` is schema-defined by the error code rather than an arbitrary object.
- Each procedure contract declares the public error codes it intentionally exposes.

The exact tRPC formatter shape is established by the exemplar migration. One shared router mapping
converts typed operation failures to the public envelope; individual procedures do not invent error
messages or transport codes. Transport authentication and malformed-contract failures enter the same
public model through centralized boundary mapping.

## Client handling

Client-runtime validates the public envelope and exposes one typed client error model to Web and
mobile. Feature adapters map known codes to contextual recovery actions and presentation.

- UI code does not inspect message strings or server error classes.
- Unknown codes receive a safe generic fallback containing the request ID.
- Query retry policy applies only to explicitly transient and retryable categories.
- Mutations do not retry automatically unless their shared definition declares the operation
  idempotent and safe to retry.
- Feature hooks or error boundaries own expected recovery behavior; leaf components do not duplicate
  transport interpretation.
- React error boundaries handle rendering defects, not expected query or mutation outcomes.

```text
native adapter outcome
    ↓ normalize
typed capability failure
    ↓ coordinate
typed operation failure
    ↓ shared router mapping
public contract error
    ↓ client-runtime validation
typed client error
    ↓
feature recovery and presentation
```

## Rationale

- Types show every expected outcome at operation and capability call sites.
- Validation is performed where the relevant trust and vocabulary exist.
- Native infrastructure details cannot leak into domain logic or client behavior.
- One public envelope gives all clients stable handling, retry, and support semantics.
- Unexpected defects remain visible in diagnostics instead of being disguised as ordinary outcomes.
- Result types are used at meaningful fallible boundaries without infecting every pure helper.

## Rejected alternatives

- **Throw exceptions for every expected outcome.** Type signatures conceal required branches and
  ordinary behavior relies on catch control flow.
- **Return `Result` from every function.** Deterministic helpers acquire noise without a meaningful
  failure boundary.
- **Validate only in the router.** Domain state, persistence, and native resources have different
  invariants and trust boundaries.
- **Trust TypeScript types for external data.** Types disappear at runtime and cannot validate
  independently updated clients or mutable files.
- **Expose native error messages.** Client behavior becomes platform-dependent and sensitive details
  can leak.
- **Use free-text public errors.** UI recovery and tests depend on copy and string matching.
- **Catch every exception and return `not-found`.** Defects become misleading user outcomes and lose
  diagnostic urgency.
- **Let each router define its own mapping.** Public categories, copy, redaction, and request IDs
  drift.

## Consequences

- Existing thrown expected errors must migrate to typed operation or capability results.
- Adapters need explicit native-error normalization and focused integration tests.
- Contracts gain common error schemas plus procedure-specific allowed-code declarations.
- The daemon gains one correlation, logging, redaction, and transport mapping boundary.
- Web and mobile error wrappers converge on one client-runtime parser and classification.
- Existing error text remains product copy only where intentionally retained; it is no longer a
  behavioral API.
- Cancellation, retry, compensation, and idempotency must be declared where operations need them,
  not inferred globally by execution agents.

## Enforcement and proof

Static checks should discourage router-local error construction, message-string discrimination,
native adapter errors crossing into operations, and public error payloads outside contracts.
Exhaustiveness checks should cover public error codes and their detail schemas.

Each migrated flow must prove malformed contract rejection, an important domain or application
failure, native adapter normalization where relevant, centralized public mapping and redaction,
client-runtime parsing, and the user recovery behavior for its significant codes. Unexpected-error
tests must retain diagnostic correlation while demonstrating that stacks and sensitive details do
not cross the wire.
