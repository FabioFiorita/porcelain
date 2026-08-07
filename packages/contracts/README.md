# @porcelain/contracts

Shapes that cross a **client** boundary — WS protocol, env helpers, and the **full
public procedure catalog** (`PROCEDURE_NAMES` + `procedureIo`). See
`docs/internals/architecture.md`.

- `procedureIo[name]` is the I/O zod for every daemon procedure (refined where a
  second client needs precision; otherwise `z.unknown()`).
- Drift: `scripts/lint-procedure-contracts.mjs` (in `pnpm lint`).
- AppRouter type stays on the daemon (`@backend/api`). **Never import from `apps/*`.**

No build step. Bundled from source via workspace alias / exports. Zod only.

