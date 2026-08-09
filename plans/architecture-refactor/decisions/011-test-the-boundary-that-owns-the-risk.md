# 011 — Test the boundary that owns the risk

- **Status:** Accepted
- **Accepted:** 2026-08-09

## Context

Porcelain has unit, hook, component, integration, and E2E tests, but suite names alone do not explain
which regression each test prevents. Business behavior exercised only through E2E is slow and hard
to diagnose. Conversely, operation tests with fakes cannot prove that Git, filesystems, persistence,
contracts, transports, and independently compiled clients agree in production.

The testing architecture must create enough server confidence that Web and mobile can test rich
behavior against mocked daemon responses, while retaining focused real-boundary proof. Test quantity
and line coverage cannot substitute for assigning each risk to its owning seam.

## Decision

Test behavior at the lowest architectural boundary that completely owns its risk: application
operation tests are the server regression backbone, adapters prove real external behavior, clients
test against contract-valid daemon mocks, and a small E2E suite proves only critical assembled-system
wiring and runtime behavior.

## Responsibility matrix

| Boundary | What its tests prove |
|---|---|
| Domain rule | Business decisions, calculations, and invariants |
| Application operation | Complete intention, orchestration, failures, and resulting state |
| Adapter | Real filesystem, Git, persistence, process, or platform behavior |
| Contract | Runtime schemas accept and reject the intended wire data |
| Router | Authentication, mapping, output validation, and public error behavior |
| Client-runtime | Query identity, mutation consequences, optimism, invalidation, and state machines |
| Web/mobile feature | User-visible behavior against a mocked public daemon boundary |
| E2E | A few critical boundaries work together in the shipped runtime |

A feature does not need one test from every row. Its specification identifies the boundaries that
contain meaningful risk and assigns each behavior once at the lowest complete owner.

## Domain and operation tests

Pure domain rules use focused table-driven or property-style tests where the input space warrants
them. They do not construct transports, adapters, or application context.

Application operation tests:

- construct a bound operation with focused fakes, stubs, or in-memory capabilities;
- invoke one complete user or agent intention directly;
- cover its successful workflow and meaningful typed failures;
- prove cross-domain coordination and mixed-effect behavior where relevant;
- assert returned results and durable resulting state primarily;
- assert interaction or ordering only when that interaction is itself part of correctness;
- prove forbidden effects do not occur after an early rejection;
- prove change facts are produced only after successful state changes.

Operation tests do not create a tRPC caller, access developer data, or invoke real Git merely to
exercise business behavior. They are fast, deterministic, and comprehensive enough to form the main
server regression suite.

## Adapter integration tests

Fakes prove the application uses a capability correctly; they cannot prove the concrete adapter
correctly represents an external system. Adapters receive focused integration tests using controlled
real resources when practical:

- temporary Git repositories;
- isolated temporary filesystem trees, including relevant path and symlink behavior;
- test databases or persisted documents;
- controlled child processes;
- platform resources appropriate to the adapter.

These tests prove serialization, parsing, atomicity claims, cleanup, compatibility, platform edge
cases, and native-error normalization. They do not repeat the full matrix of application workflows.
Error-path stubs remain acceptable when a real resource cannot reliably produce the native condition
under test.

## Contract and router tests

Contract tests provide representative valid fixtures and reject malformed boundary data, including
important output and error shapes. Mechanical exhaustiveness checks cover every public procedure,
event, and declared error code rather than relying on one handwritten test per name.

Router tests remain narrow. They prove authentication, contract-to-operation mapping, public output
validation, centralized error mapping and redaction, and request correlation. Operation behavior is
not duplicated through a router caller.

## Client-runtime and application tests

Client-runtime tests exercise shared pure semantics directly:

- query identity and normalized key construction;
- mutation affected-query declarations;
- optimistic apply, rollback, and authoritative reconciliation;
- notification-to-query mapping;
- session, reconnect, and subscription state machines;
- shared product transformations.

Web and mobile feature tests mock the daemon at its public contract boundary, not internal hooks,
stores, or child components. They run real feature adapters and presentation behavior against
configured public outcomes.

The shared mock harness:

- uses contract schemas and domain fixture builders;
- rejects mock requests or responses that violate contracts;
- supports success, expected failure, latency, and unavailable states;
- returns configured outcomes without duplicating daemon business rules;
- is reused across clients where their transport adapters allow it.

Client tests prove visible behavior, actions, pending state, recovery, navigation, and accessibility.
Server operations prove whether the underlying business intention is correct.

## E2E tests

E2E proves risks that lower boundaries cannot:

- daemon startup, client authentication, and real transport wiring;
- a critical public request reaching the intended operation;
- WebSocket reconnect, subscription restoration, and missed-change recovery;
- terminal attachment and streaming across the actual process boundary;
- browser or packaging behavior that differs materially from the test DOM;
- a small set of essential assembled-product journeys.

E2E does not exhaustively cover validation branches, error codes, domain invariants, mutation states,
or visual variants already owned below. It is a wiring and runtime confidence layer, not the
business regression backbone.

Existing E2E tests are classified during migration:

- keep or strengthen tests protecting a unique cross-boundary risk;
- move duplicated business branches to operation tests;
- move UI-only behavior to contract-backed component tests;
- treat screenshot evidence without stable assertions as review proof rather than regression tests;
- remove tests with no identifiable protected behavior after confirming they add no unique coverage.

## Regression rule

For every bug:

1. Add the smallest failing test at the boundary that owned the defect.
2. Add a higher-level test only if the defect escaped because integration between boundaries was not
   proved.
3. Do not add E2E merely because the defect was first observed through the UI.

The test name describes the product behavior or invariant that failed, not the implementation method
called while arranging it.

## Test quality

- Tests are deterministic and independent of execution order or developer-machine state.
- Time, randomness, identifiers, and environment-specific behavior use explicit test capabilities.
- Filesystem, Git, and persistence resources are isolated and cleaned up.
- Tests wait for observable conditions rather than arbitrary sleeps.
- Fakes model capability contracts without reimplementing production business logic.
- Broad module mocks and assertions about every internal call are fallback techniques.
- Snapshot tests are reserved for stable structured output, not broad UI approval.
- Coverage reports are diagnostic. No numeric target replaces proof of important success, failure,
  recovery, and invariant branches.
- Flaky tests are defects to fix at their synchronization or isolation boundary, not retries to hide.

## Rationale

- Most business regressions fail quickly at the operation that owns them.
- Real adapters preserve confidence in external systems without slowing every scenario.
- Contract-backed client mocks make UI tests fast and independent without inventing a second server.
- Small E2E coverage catches assembly mistakes without duplicating the entire test pyramid.
- Boundary ownership makes failures easier to locate and obsolete tests easier to remove.
- Bug regression tests accumulate architectural confidence rather than defaulting to the slowest lane.

## Rejected alternatives

- **Test all behavior through E2E.** Feedback is slow, failures are ambiguous, and branches become
  expensive to cover.
- **Trust operation tests alone.** Fakes cannot prove adapters, schemas, transport wiring, or runtime
  packaging.
- **Mock internal client hooks and stores.** Tests verify a fabricated component environment instead
  of the feature boundary.
- **Use real daemon behavior in every component test.** UI feedback slows and server business cases
  are duplicated.
- **Require every feature to have every test type.** Empty ceremony replaces risk analysis.
- **Optimize for line coverage.** Executed lines do not demonstrate meaningful outcomes or recovery.
- **Add an E2E for every UI-observed bug.** The symptom location is mistaken for the defect owner.
- **Retry flaky tests automatically.** Timing and isolation defects remain in the suite.

## Consequences

- The existing suite needs a behavior inventory before tests are retained, moved, or removed.
- Operation and contract-backed client harnesses become foundational migration work.
- Adapter tests may require reusable temporary-resource builders.
- The critical E2E list must be named explicitly and kept intentionally small.
- Test commands and CI lanes should reflect fast behavioral tests, focused integrations, and slower
  assembled-system proof without changing the existing push gate casually.
- Each execution specification identifies owned risks and required tests instead of saying only “add
  unit tests” or “add E2E.”

## Enforcement and proof

Test linting can enforce isolation conventions, banned arbitrary sleeps, contract fixture validation,
and required suite commands where reliable. Coverage tooling remains informational unless a later
decision identifies a narrow critical threshold.

Each migrated domain must demonstrate fast operation coverage for its important intentions, real
integration proof for changed adapters, contract-valid client mocks for significant UI behavior, and
E2E only for named assembly risks. The migration report must identify redundant tests removed and the
lower boundary now protecting each behavior.
