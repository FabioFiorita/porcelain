# Domain architecture and migration rules

Porcelain is migrating from horizontal technical folders to one domain-first architecture without
changing its runtime topology. The accepted target and its inventories live under
`plans/architecture-refactor/`; this page states the rules that are already active for contributors
and agents while that migration is in progress.

## Start with one of ten domains

The canonical product keys are:

```text
projects · files · git · search · review · board
actions · terminal · project-data · remote
```

Use the same key in contracts, daemon, client-runtime, Web, mobile, CLI, tests, and target paths.
Shell, Viewer, Settings, UI, daemon composition, Desktop, native integration, and infrastructure are
supporting regions, not extra product domains. Settings assembles controls; it does not own the
behavior behind them.

Current synonyms remain visible in legacy code: `feature` often means Review, `repo` or `workspace`
often means Project, Changes/History belong to Git, Comments belong to Review, and saved commands
belong to Actions rather than Terminal. Do not extend these aliases. A completed cutover deletes them
atomically instead of adding compatibility.

The naming authority and full ownership table are
[`plans/architecture-refactor/domain-registry.md`](../../plans/architecture-refactor/domain-registry.md).

## Follow one intention through the same boundaries

```text
contract
    ↓
router — authenticate, parse, invoke one operation, map result
    ↓
application operation — complete orchestration for one intention
    ↓
pure rules + capability ports
    ↓
composition-injected adapters
    ↓
typed notification or stream consequence
    ↓
client-runtime semantics
    ↓
Web/mobile feature adapter and presentation
```

Every public procedure has one operation, including simple reads. Operations do not call operations.
A cross-domain operation visibly depends on narrow capabilities exported by the participating
domains; required work is never hidden behind events. Routers contain no product decisions and
domain rules perform no I/O.

Runtime packages remain hard boundaries. Contracts own exhaustive runtime-validated wire shapes and
never import applications. Daemon never imports clients. Web and mobile never import daemon source
or one another. Client-runtime owns shared nonvisual query, mutation, notification, error, and
session semantics without importing React, DOM, browser, or native APIs.

The exact target file shapes, error model, realtime categories, persistence rules, and test matrix
are in
[`plans/architecture-refactor/target-architecture.md`](../../plans/architecture-refactor/target-architecture.md).

## Treat migration as a ratchet

The architecture registry records each domain's migration stage and target roots. Contract roots are
currently staged as `migrating` while product behavior remains in its inventoried horizontal paths;
later bounded specifications advance the domain only as each cross-package cutover lands. Existing
horizontal paths may remain while inventoried. They may shrink, not grow.

- New or migrated feature code uses the canonical domain paths.
- A domain exposes one narrow `index.ts`; foreign domains do not deep-import its internals.
- Generic containers such as `service.ts`, `manager.ts`, `utils.ts`, `helpers.ts`, `common.ts`,
  `types.ts`, and `constants.ts` are not target feature names.
- No allowlist or count is increased to make a change pass.
- A migration updates contracts, daemon, shared client semantics, Web/mobile/CLI callers, tests, and
  legacy deletion as one preplanned cutover.
- There is one version-1 wire/storage path. Historical aliases, dual reads/writes, migrations, and
  old-shape fallbacks are deleted; genuine reconnect, corruption, resource, security, and platform
  resilience remains.

`scripts/lint-architecture.mjs` enforces the rules that are objective today: the domain registry,
package direction, target feature naming, a repository-wide authored production file ceiling, and
shrink-only baselines for existing raw Web/server imports and oversized files. More gates become
strict as each domain lands; execution agents never mark a domain complete or edit its baseline
without the specification that removes the corresponding legacy path.

`scripts/lint-architecture-specs.mjs` keeps the migration executable by less architecture-aware
agents. It checks recipe/catalog identity and status, required executor sections and order, known
dependencies, dependency cycles, complete recipe coverage for non-landed work,
Ready-versus-Landed prerequisites, primary-exemplar metadata, and placeholder language that
delegates an unresolved choice.

## Test the owner of the risk

Operation tests are the daemon regression backbone. Pure-rule tests prove decisions; adapter
integration tests prove real filesystem, Git, storage, process, and platform representations;
contracts prove the wire; router tests prove transport mapping and safe errors; client-runtime tests
prove query/mutation/realtime semantics; Web/mobile features use contract-valid daemon mocks. E2E is
reserved for a small named set of assembled startup, authentication, transport, reconnect, Terminal,
and packaging risks.

When fixing a bug, add the smallest failing test at the boundary that owned the defect. A higher test
is added only when the bug escaped because the integration between boundaries lacked proof.
