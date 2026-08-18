# @porcelain/contracts

Shapes that cross a **client** boundary — WS protocol, env helpers, public errors, and the
procedure catalog. See [`docs/architecture.md`](../../docs/architecture.md).

- Domain records own each procedure name, kind, input/output schema, and error list. Each domain
  has a public entry point at `@porcelain/contracts/<domain>`.
- `procedureCatalog` composes those records into one flat frozen catalog; `ProcedureName` is
  derived from it rather than maintained as a second list.
- Every daemon router procedure binds `procedureCatalog.<name>.input` / `.output` exactly once.
- `packages/contracts/src/procedure-catalog.test.ts` covers catalog behavior.
- AppRouter type stays on the daemon (`@backend/api`). **Never import from `apps/*`.**

No build step. Bundled from source via workspace alias / exports. Zod only.
