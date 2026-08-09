# 012 — Enforce the target architecture

- **Status:** Accepted
- **Accepted:** 2026-08-09

## Context

Architecture described only in prose decays when contributors and execution agents follow the
shortest available import path. Porcelain already enforces valuable rules through Biome, package
exports, custom lint scripts, procedure-contract checks, documentation checks, and mobile file-size
guards. The target feature architecture should extend that discipline instead of relying on every
agent to reread every decision correctly.

The existing code cannot satisfy all target rules immediately. Enabling universal strict checks
before migration would either block all work or require broad exemptions that hide new violations.
Enforcement must distinguish bounded legacy debt from migrated domains and ensure that the legacy
surface only shrinks.

## Decision

Canonical names, package exports, import-direction checks, exhaustive registries, file-size guards,
and migration-aware shrink-only allowlists mechanically enforce objective architecture rules; human
review remains responsible for conceptual cohesion and domain ownership.

The design goal is that the easiest compiling import is also the architecturally correct import.

## Canonical naming

The domain inventory establishes each canonical product noun, its stable domain key, and any legacy
wire, persistence, or host aliases. Every participating package uses that exact domain key in target
architectural paths.

Within a domain:

- operations use verb-object names such as `write-file.ts` and `complete-review.ts`;
- an operation factory is `createWriteFile` and its bound operation is `writeFile`;
- operation types use names such as `WriteFileInput`, `WriteFileResult`, and `WriteFileFailure`;
- capability names are cohesive nouns such as `WorkspaceFiles`, `ProjectGit`, and `ReviewStore`;
- contract values use names such as `writeFileInputSchema` and inferred `WriteFileInput`;
- router files use `<domain>.router.ts`;
- unit tests remain colocated as `.test.ts` or `.test.tsx`;
- real-adapter tests use `.integration.test.ts`;
- assembled browser/system E2E uses `.spec.ts`;
- one `index.ts` exposes the public domain boundary.

Internal code uses direct local imports. Barrel files define public boundaries rather than forming
chains of convenience re-exports.

New generic feature filenames such as `utils.ts`, `helpers.ts`, `common.ts`, `service.ts`,
`manager.ts`, `types.ts`, and `constants.ts` are rejected. The owned concept appears in the name,
such as `workspace-paths.ts`, `review-transitions.ts`, `terminal-session-manager.ts`, or
`files-limits.ts`.

Words such as `Manager` and `Service` remain valid when they describe a real cohesive lifecycle or
external service. They are not default containers for unrelated behavior.

## Package dependency direction

The target package graph permits:

```text
contracts ──────────────────────────────┐
shared ─────────────────────────────────┤
                                       ↓
                               client-runtime
                                  ↙         ↘
                                Web        mobile

contracts/shared → daemon
contracts/shared → CLI
contracts/shared → desktop shell where native integration requires them
```

Hard rules:

- contracts remain dependency-light and independent of every application;
- shared contains pure cross-runtime behavior and imports no app;
- client-runtime imports contracts and shared, never an app or platform runtime;
- daemon never imports client-runtime, Web, mobile, UI, or desktop;
- Web and mobile never import daemon or each other;
- desktop contains no product business logic;
- applications communicate through contracts instead of another application's source tree.

Temporary daemon type imports currently used by Web must disappear as exhaustive contracts replace
them. They cannot become permanent exceptions to the target graph.

## Intra-domain dependency direction

```text
router
  ↓
operation
  ↓
domain rules + capability types
  ↓
concrete adapters only through composition

composition root
  ↓
concrete implementations required for construction
```

Mechanical checks reject:

- routers importing concrete adapters or persistence;
- operations importing routers or tRPC;
- operations importing concrete adapters;
- domain rules importing I/O, transport, React, or app state;
- operations importing other operations;
- cross-domain deep imports;
- cross-domain concrete-store imports;
- circular domain dependencies;
- presentation components importing raw daemon, tRPC, WebSocket, or query-client APIs;
- client-runtime importing UI frameworks or platform modules.

The explicit composition root is the construction exception allowed to import concrete adapters and
operation factories. Domain tests may import private files inside the domain they own.

## Public entry points

- Each domain exposes a narrow local entry point for foreign-domain use.
- Package export maps expose only supported package/domain subpaths.
- A foreign domain imports the public entry point, never a nested implementation path.
- Client applications import stable client-runtime subpaths directly rather than app-local pass-
  through wrappers.
- Entry points export capabilities and types intended for collaboration, not every internal symbol.

The migration exemplar establishes exact alias and export-map conventions before agents copy them.

## File-size policy

Authored production modules have a hard ceiling of 450 lines. This extends the existing mobile guard
across daemon, contracts, client-runtime, Web, desktop, CLI, and shared authored source.

- Existing oversized files enter an exact shrink-only allowlist.
- An allowed file may become smaller but never larger.
- New authored modules cannot join the allowlist through ordinary feature work.
- Generated, vendored, and machine-owned protocol artifacts use explicit classified exclusions.
- Test files are reviewed for cohesion but do not initially share the production hard ceiling.
- A file below 450 lines can still violate ownership; the number is a backstop, not a design method.

A temporary size waiver records the exact file, current maximum, concrete reason splitting is unsafe,
owning migration specification, and removal condition. Broad directory globs are forbidden.

## Migration-aware enforcement

Target rules are enabled incrementally without allowing legacy debt to spread:

1. A canonical architecture registry records domain keys, aliases, participating packages,
   migration status, and approved dependency relationships.
2. Strict target checks apply immediately to migrated domains and all new target-shaped files.
3. Existing violations are captured as exact, reviewable, shrink-only entries.
4. Completed specifications remove legacy entries and cannot add equivalent debt elsewhere.
5. Once all domains comply, transitional allowlists and migration-status branches are deleted and
   the rules become universal.

The registry becomes a mechanical input and navigation index, not a second prose architecture. The
inventory phase chooses its concrete format and keeps product explanation in documentation.

## Objective and judgment rules

Automation owns rules that can be answered mechanically:

- package dependency direction and public exports;
- cross-domain deep imports and dependency cycles;
- router, operation, domain-rule, and adapter dependency direction;
- presentation-to-transport separation;
- operation-to-operation imports;
- file-size ceilings and shrinking allowlists;
- contract/procedure, notification/query, and public-error exhaustiveness;
- canonical registered domain keys in target paths.

Human architecture review owns judgments that cannot be reduced safely to syntax:

- whether a domain boundary matches the product;
- whether a capability is cohesive and correctly owned;
- whether an abstraction is premature;
- whether workflow ownership expresses the actual intention;
- whether similar implementations genuinely share one responsibility;
- whether an exception is safer than immediate compliance.

Rules begin as prose only while judgment remains unsettled. Once an objective convention is accepted
and implementable, leaving it unenforced is migration work, not a permanent documentation strategy.

## Exception policy

An architecture exception is explicit, exact, narrow, and temporary. It records:

- the violated rule and exact path or dependency;
- the concrete reason compliance currently causes harm;
- the specification responsible for removal;
- the measurable removal condition.

Inline “temporary” comments do not disable gates. Execution agents cannot introduce or broaden a
waiver unless their governing specification explicitly authorizes it. A new exception is an
architecture-review event, not routine implementation cleanup.

## Rationale

- Correct boundaries survive contributors and agents who have not memorized the decision history.
- Package exports and lint feedback teach the architecture at the moment of use.
- Migration-aware strictness prevents both all-at-once blockage and permanent broad exemptions.
- Canonical naming makes cross-package feature tracing predictable.
- Shrink-only limits stop large legacy modules and forbidden imports from growing during transition.
- Human review remains focused on ownership and product meaning rather than repeatable syntax checks.

## Rejected alternatives

- **Document conventions only.** The shortest available import eventually wins over prose.
- **Enable every target gate universally now.** Broad failures would block unrelated work or force
  meaningless mass exemptions.
- **Use unrestricted allowlists.** Legacy architecture can grow while the gate remains technically
  green.
- **Forbid generic suffixes as words everywhere.** Legitimate lifecycle managers and external
  services would receive unnatural names; the problem is generic ownership, not vocabulary alone.
- **Use file length as the architecture.** A collection of small files can still form an opaque
  dependency graph.
- **Generate all architecture documentation from code.** Mechanical structure cannot explain
  rationale, tradeoffs, or product ownership.
- **Let execution agents add waivers freely.** Exceptions become the easiest path and target rules
  stop converging.

## Consequences

- The inventory phase must create the canonical domain and alias map before structural migration.
- Initial enforcement work includes a dependency graph check, broader file-size guard, and exact
  legacy baselines.
- Existing package leaks and large files remain visible debt rather than blockers until their owning
  specifications land.
- The first exemplar must establish operation naming, entry points, composition wiring, and test
  naming concretely.
- Contributor documentation is updated from the target plan only as rules become current truth.
- Transitional enforcement code and allowlists are deleted after convergence.

## Enforcement and proof

The repository gate must fail on a new target-boundary violation, an increase to an allowlisted
legacy violation, a domain cycle, an unregistered domain path, or an oversized new production file.
Its failure output names the violated architectural rule and the expected import or ownership path.

Each migration specification identifies the registry entries and allowlist debt it removes. A domain
is marked migrated only after its contracts, daemon flow, shared client semantics, participating UI
adapters, tests, imports, and file sizes pass target checks without domain-specific exemptions.
