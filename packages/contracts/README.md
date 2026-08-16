# @porcelain/contracts

Shapes that cross a **client** boundary — WS protocol, env helpers, public errors, and the
**ten-domain procedure catalog**. See `docs/internals/architecture.md`.

- Ten domain records (`remote`, `projects`, `files`, `search`, `git`, `tasks`, `actions`,
  `terminal`, `project-data`) own every procedure name, kind, exact input/output zod, and error
  list. Each domain has a public entry point: `@porcelain/contracts/<domain>`.
- `procedureCatalog` composes those records into one flat frozen catalog of exactly **96**
  procedures; `ProcedureName` is `keyof typeof procedureCatalog`. There is no separate name list,
  no partial refinement map, and no `z.unknown()` I/O.
- Every daemon router procedure binds `procedureCatalog.<name>.input` / `.output` exactly once.
- Drift: `scripts/lint-procedure-contracts.mjs` (in `pnpm lint`) plus
  `packages/contracts/src/procedure-catalog.test.ts`.
- AppRouter type stays on the daemon (`@backend/api`). **Never import from `apps/*`.**

No build step. Bundled from source via workspace alias / exports. Zod only.
