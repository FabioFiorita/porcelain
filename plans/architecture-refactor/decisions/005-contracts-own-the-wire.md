# 005 — Contracts own the wire

- **Status:** Accepted
- **Accepted:** 2026-08-08

## Context

Porcelain has several independently compiled consumers of daemon behavior: Web, mobile, CLI, and
the Electron-loaded Web client. Type inference from the daemon router can help a tightly coupled
TypeScript client, but it is not an executable runtime contract and can pull server ownership into
other runtimes. Local client schemas and handwritten duplicate types can drift from the behavior
the daemon actually accepts and returns.

The existing contracts package already provides a strong foundation, but its refined runtime
schemas do not yet exhaustively describe every procedure and event. Public vocabulary also contains
historical code terms that differ from current product language. An architecture migration must not
silently rename compatible wire or persisted behavior while trying to improve internal clarity.

## Decision

`packages/contracts` is the single exhaustive source of runtime schemas, inferred types, procedure
and event names, and canonical public vocabulary for data crossing Porcelain process boundaries; it
does not own internal application, domain, persistence, or presentation models.

## Contract ownership

Contracts are organized by the same product domains established in Decision 002. For each public
request/response procedure, the package owns:

- the canonical procedure name;
- the runtime Zod input schema;
- the runtime Zod output schema;
- TypeScript input and output types inferred from those schemas;
- stable identifiers and serialized value formats used by the procedure.

For each public realtime message, it owns:

- the canonical event name and envelope discriminator;
- the runtime payload schema;
- the inferred payload type;
- any public correlation or revision fields.

The public error vocabulary will also live in contracts after the dedicated error decision defines
its model.

Every tRPC procedure and authenticated WebSocket message has exactly one contract definition. The
public catalog is composed from the domain contract modules so names and schemas cannot drift in
separate handwritten registries.

## Runtime use

- Daemon routers import contract schemas rather than redefining transport validation.
- Web, mobile, CLI, and client-runtime import the same schemas and inferred types rather than local
  substitutes.
- Untrusted request, response, and event data is validated at the owning runtime boundary.
- Type-only inference from `AppRouter` does not substitute for a runtime output or event contract.
- Public values are deliberately serializable. Database rows, filesystem objects, class instances,
  native errors, and adapter-specific values do not cross the wire directly.
- Types are inferred from runtime schemas. A handwritten type duplicating a schema is forbidden.

The precise client transport wrapper and where response parsing occurs are settled with the shared
client-runtime decision. The invariant is that every consumer uses the authoritative contract, not
whether each component invokes `schema.parse` itself.

## Contracts and application models

Contracts describe untrusted serialized data at a process boundary. Application and domain models
describe trusted concepts used to perform behavior. They may have an identical shape without having
the same architectural owner.

The router maps contract input into operation input and maps the operation result into contract
output. When the representations are genuinely identical, the mapping may be a direct typed pass;
ceremonial object copying is not required.

The contracts package does not automatically own:

- domain entities, policies, or operation dependency types;
- persistence records, migrations, or database schemas;
- filesystem, Git, PTY, or operating-system representations;
- React form state or client view models;
- component props or screen-navigation parameters;
- internal events that never cross a process boundary.

Client forms may impose presentation-specific validation or partial-edit states. They compose
contract primitives for shared concepts rather than redefining identifiers, paths, enums, or other
wire vocabulary.

## Vocabulary and compatibility

- New public APIs use the canonical product vocabulary.
- Existing public procedure names, discriminators, and serialized fields remain stable unless a
  separately accepted compatibility migration changes them.
- Historical names such as code-level `feature` versus product-level `Review` are documented as
  wire or persistence aliases until explicitly migrated.
- Internal code may adopt canonical language through an explicit mapping at the boundary.
- The domain inventory records one canonical product noun and every legacy wire, persistence, or
  host alias that must remain compatible.

Mobile and remote clients may not update in lockstep with the daemon. Breaking contract changes
therefore require an explicit compatibility and rollout plan; they cannot enter an unrelated
architecture migration.

## Illustrative shape

```text
packages/contracts/src/files/
├── list-files.contract.ts
├── read-file.contract.ts
├── write-file.contract.ts
├── files-events.ts
└── index.ts
```

Small domains may combine several contracts in one clearly named module. The domain boundary and
single definition matter more than one-file-per-procedure symmetry.

## Rationale

- Every consumer can execute the same validation used to define daemon behavior.
- Mobile does not need server router imports or locally copied Zod schemas.
- Runtime validation catches drift that TypeScript inference cannot see across process or version
  boundaries.
- Separating wire and application ownership keeps serialization concerns out of business rules.
- A domain-organized contract catalog provides a reliable first stop for tracing any public flow.
- Explicit compatibility aliases allow product language to improve without accidental breakage.

## Rejected alternatives

- **Use only `AppRouter` inference.** It is compile-time coupling, not runtime validation, and does
  not serve every independently deployed client safely.
- **Let each client define its own schemas.** Multiple executable truths inevitably drift.
- **Put all shared-looking types in contracts.** This turns a wire boundary into a general dumping
  ground and couples transport to persistence and presentation.
- **Make contract types the domain model by rule.** Serialization choices would dictate internal
  behavior even when the concepts need different guarantees.
- **Maintain a separate procedure-name registry manually.** Catalog and schema definitions can
  disagree while each appears valid.
- **Normalize legacy public names during file moves.** Architectural cleanup would become an
  unplanned breaking migration.

## Consequences

- Procedures and events without refined schemas must gain them incrementally.
- Local daemon, Web, mobile, CLI, and client-runtime duplicates must be removed as their domains
  migrate.
- Routers become explicit contract-to-operation boundaries even when their mappings are trivial.
- The migration inventory must classify shared types by actual ownership rather than current import
  location.
- Contract compatibility becomes a first-class constraint for independently updated clients.
- Error schemas and response parsing await their dedicated decisions; execution agents cannot invent
  those conventions domain by domain.

## Enforcement and proof

The existing procedure-to-contract lint should evolve from name coverage into exhaustive input and
output schema coverage. Equivalent checks should cover public WebSocket events. Import rules should
prevent clients and routers from defining local replacements for public contracts where static
analysis can identify them.

Each migrated public flow must show one domain-owned contract definition, daemon use of its input
and output schemas, and reuse by every consuming client runtime. Tests must demonstrate runtime
rejection of representative invalid boundary data without coupling domain-rule tests to wire
validation.
