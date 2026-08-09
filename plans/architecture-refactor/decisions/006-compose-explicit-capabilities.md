# 006 — Compose explicit capabilities

- **Status:** Accepted
- **Accepted:** 2026-08-08

## Context

Application operations need filesystem, Git, persistence, PTY, process, time, configuration, and
cross-domain capabilities. Importing concrete instances directly makes dependencies invisible and
forces tests to patch modules or use real host resources. A dependency-injection framework could
make construction uniform, but decorators, reflection, tokens, and container lookup would add a
second runtime model without improving Porcelain's product ownership.

Persistence also needs precise language. Some domain state behaves like an aggregate collection,
while other state is a document, key-value store, filesystem projection, or host capability.
Calling every adapter a repository would provide superficial symmetry and obscure the behavior it
actually guarantees.

## Decision

One explicit daemon composition root constructs concrete adapters and injects capability-shaped
dependencies into bound application operations; product domains own their persistence semantics,
and operations state consistency boundaries without pretending unrelated host effects are atomic.

## Composition

The production dependency graph is assembled once at daemon startup:

```text
daemon composition root
    ├── reads and validates configuration
    ├── constructs infrastructure and domain adapters
    ├── constructs bound application operations
    ├── supplies those operations to routers and other entry points
    └── owns lifecycle and cleanup of long-lived resources
```

- Routers and operations do not construct concrete adapters.
- Operations do not import global adapter instances or access a service locator.
- Dependencies are explicit structural TypeScript types passed to operation factories.
- Routers receive bound operations rather than rebuilding their dependency objects per request.
- A request-scoped value such as authenticated session context remains operation input or explicit
  request context; it is not captured accidentally in a process-wide singleton.
- Stateful adapters may be long-lived when their resource semantics require it. Their startup,
  failure, and cleanup remain visible at the composition root.

```ts
type WriteFileDependencies = {
  workspaceFiles: WorkspaceFiles
  projectStore: ProjectStore
  clock: Clock
}

export function createWriteFile(dependencies: WriteFileDependencies) {
  return async function writeFile(input: WriteFileInput) {
    // Complete workflow.
  }
}
```

The exact root file and router factory signatures are chosen during the exemplar migration, then
copied by later specifications. There must be one recognizable production construction path rather
than feature-specific wiring conventions.

## What becomes a dependency

Inject values whose implementation is effectful, nondeterministic, environment-specific,
stateful, or legitimately substitutable:

- filesystem, Git, PTY, process, network, and operating-system access;
- domain persistence capabilities;
- time, randomness, and identifier generation;
- parsed configuration and host paths;
- cross-domain capabilities accepted by Decision 004;
- transaction or unit-of-work scopes when real storage supports them.

Pure deterministic domain functions are imported normally. Injecting every policy, parser, helper,
or utility would hide ordinary code navigation behind unnecessary indirection.

Configuration and environment variables are read and validated at the composition boundary. A
domain operation receives meaningful values or a narrow configuration type, not ambient `process.env`.

## Capability design

- A capability is named for the cohesive ability the caller needs, not a broad implementation
  category.
- Its public type reveals relevant inputs, results, and failure modes.
- It is as narrow as the responsibility while remaining a stable concept, not one interface per
  individual adapter method by rule.
- Structural TypeScript types are sufficient; an `I` prefix, abstract base class, token registry,
  or `Impl` suffix is not required.
- Concrete adapters may implement several closely related low-level methods, but operations receive
  only the capability surface they need.

Examples of useful names include `ProjectGit`, `WorkspaceFiles`, `ReviewStore`, and `Clock`.
`IGitService`, `FileManagerImpl`, `CommonRepository`, and generic `platformService` names do not
communicate a product capability.

## Persistence ownership

- The product domain that owns state owns the capability used to persist and retrieve it.
- Other domains use a narrow public domain capability and never its concrete store, database table,
  serialized file, or query implementation.
- Product-specific queries remain with their domain even when several domains share a low-level
  SQLite connection or atomic-file writer.
- Storage records are mapped at the adapter boundary and do not automatically become contract,
  application, or domain models.
- In-memory implementations are first-class test adapters when they can faithfully represent the
  capability's relevant semantics.

Use `Repository` when the abstraction genuinely offers collection or aggregate persistence
semantics. Use names such as `Store`, `Document`, `Snapshot`, `Log`, `Files`, or a capability-specific
noun when those describe the guarantees more accurately.

## Consistency boundaries

The coordinating application operation declares ordering and the consistency boundary for its
workflow.

- Changes sharing transactional storage may use an explicitly injected unit-of-work capability.
- Domain capabilities participating in that transaction must do so through an intentional typed
  scope, not ambient connection state.
- Filesystem, Git, PTY, operating-system processes, network calls, and database writes are not
  described as one atomic transaction when the platform cannot provide that guarantee.
- Mixed-effect workflows make ordering, partial failure, recoverability, and any compensation
  visible in the operation.
- The later error decision defines the common representation; migration agents cannot invent
  retries or compensation incidentally.

## Testing implications

Operation tests construct the operation with focused fakes, stubs, or in-memory adapters and invoke
it directly. They primarily assert returned results and durable state. Interaction assertions are
appropriate when ordering or invocation is itself part of the orchestration contract.

Module mocking, container overrides, and broad mocks duplicating concrete implementations are
fallbacks, not the standard seam. Real adapter behavior receives separate integration tests against
the resource it claims to support.

## Rationale

- The complete production dependency graph can be inspected in ordinary TypeScript.
- Operations expose all host effects and become directly testable.
- Manual function composition provides the useful part of dependency injection without a framework
  or hidden container state.
- Domain-owned persistence protects product invariants and vocabulary.
- Precise capability names communicate guarantees better than uniform `Service` or `Repository`
  suffixes.
- Honest consistency boundaries prevent code and tests from promising atomic behavior the host
  cannot provide.

## Rejected alternatives

- **Import singleton adapters from operations.** Dependencies and lifecycle become invisible, and
  tests require module patching.
- **Use a DI container or decorators.** Porcelain does not need runtime token resolution to compose
  plain TypeScript functions.
- **Pass the complete daemon context everywhere.** A service locator disguised as an object prevents
  dependencies from documenting the operation.
- **Create an interface for every implementation.** This produces files and indirection without a
  meaningful substitution boundary.
- **Inject every pure function.** Ordinary deterministic code becomes harder to follow for no test
  or runtime benefit.
- **Call every persistence adapter a repository.** The name stops communicating collection or
  aggregate semantics.
- **Share concrete stores across domains.** Persistence representation becomes a cross-domain API.
- **Treat mixed host effects as one transaction.** Failure guarantees become fictional.

## Consequences

- Existing global imports and per-router construction must converge on one composition path.
- Operation dependency objects become useful architecture documentation and review surfaces.
- Adapter tests and operation tests have distinct purposes.
- Some existing stores will retain their name; others should be renamed only when the domain
  inventory identifies their actual semantics and compatibility impact.
- The first exemplar must establish the exact factory, export, and composition-root conventions
  before execution agents repeat them.
- Error typing, retry policy, and compensation remain separate accepted decisions or explicit
  per-workflow specifications.

## Enforcement and proof

Import rules should prevent operations from importing concrete infrastructure adapters, ambient
configuration, or global application context. Architecture checks should identify routers that
construct dependencies and domain modules that import another domain's concrete persistence.

Each migrated operation must list its dependency type, show its production construction at the
single composition root, and run directly with test dependencies. Each migrated adapter must have a
clear lifecycle owner and integration proof proportional to the external resource it wraps.
