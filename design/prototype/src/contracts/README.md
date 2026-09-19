# contracts

Type-only mirror of `packages/contracts/src`, so the prototype speaks the same
shapes as the server without depending on the workspace.

These shapes follow the server review of 2026-09-18 (its decisions are in the
Porcelain Notion database, one page per section). Most of them do not exist in
`packages/contracts` yet:

- `/** PROPOSED */` marks a field or type that has no contract yet. A file whose
  header says "PROPOSED in full" is new as a whole (`review.ts`, `marks.ts`,
  `connection.ts`, `live.ts`).
- Anything unmarked exists in `packages/contracts` today with the same name, though
  its neighbours may have changed.
- Removed compared with `packages/contracts`: `review-layers.ts` and `artifacts.ts`
  (replaced by `review.ts`), `reviewed-files.ts` (replaced by `marks.ts`), the Git
  action prepare/execute pair (replaced by one request in `git-actions.ts`), and the
  signed history cursor (replaced by `before`).

`PROTOTYPE.md` → "Contracts" lists every change with the reason for it.
