# Plan 006: Refresh the inline reading surface when the agent pushes a feature update

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/renderer/src/hooks/use-app-events.ts src/renderer/src/hooks/use-feature-view.ts src/renderer/src/hooks/use-feature-reading.ts`
> If any changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

The whole-feature review has two surfaces fed by two queries: `featureView` (the
Feature **list** in the sidebar) and `featureReading` (the **inline reading
surface** in the viewer). When the agent pushes a review-set change over MCP, the
main process emits a `feature-view` app-event. The renderer's event handler
invalidates **only** `featureView`, so the list refreshes immediately but the
reading surface shows stale content until its own 3-second poll happens to fire.
The two views of the same data visibly disagree for up to ~3s during an active
agent loop. `useClearFeatureReview` already invalidates **both** surfaces (with a
comment saying exactly that) — the push handler should match it.

## Current state

`src/renderer/src/hooks/use-app-events.ts` — the `feature-view` branch (lines ~18–21):
```tsx
if (event === 'feature-view') {
  await utils.featureView.invalidate()
  return
}
```

For contrast, `src/renderer/src/hooks/use-feature-view.ts`'s `useClearFeatureReview`
does both, with the rationale in its doc comment:
```tsx
// Invalidates both feature surfaces so the list and the inline reading surface refresh.
...
await Promise.all([utils.featureView.invalidate(), utils.featureReading.invalidate()])
```

`src/renderer/src/hooks/use-feature-reading.ts` confirms `featureReading` is a
distinct query whose only liveness is `refetchInterval: 3000` — it is not
invalidated by the push event today.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `pnpm typecheck`   | exit 0 |
| Lint      | `pnpm lint`        | exit 0 |
| Tests     | `pnpm test`        | all pass |
| Full gate | `pnpm verify`      | all four pass |

## Scope

**In scope**:
- `src/renderer/src/hooks/use-app-events.ts` (the `feature-view` branch only)

**Out of scope** (do NOT touch):
- The other event branches (`update-status`, `comments`, `board`, `working-tree`,
  `close-tab`) — each already invalidates exactly the keys it changes; do not add
  invalidations there.
- `use-feature-view.ts` / `use-feature-reading.ts` — unchanged; this plan only
  aligns the push handler with them.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `fix(feature-review): refresh the inline reading surface on agent push`.
- Do NOT push unless instructed.

## Steps

### Step 1: Invalidate both feature surfaces on the `feature-view` event

Change the branch to invalidate both queries together:
```tsx
if (event === 'feature-view') {
  // the agent pushed a review-set change over MCP — refresh BOTH feature surfaces
  // (the sidebar list AND the inline reading surface) so they don't disagree until
  // the next 3s poll, matching useClearFeatureReview.
  await Promise.all([utils.featureView.invalidate(), utils.featureReading.invalidate()])
  return
}
```

Use `await Promise.all([...])` (not two bare `void` calls) — the repo bans
`void`-ing promises (`.agents/skills/audit/SKILL.md`: "Never `void` a promise").

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.

### Step 2: Full gate

**Verify**: `pnpm verify` → all four pass.

## Test plan

- No unit test is added: this repo deliberately keeps **0 tests on hooks** (thin
  declarative wrappers — see `.agents/skills/architecture/SKILL.md` "Testing", and
  the prior audit's coverage note). Adding one here would break that convention for
  a one-line wiring fix. Verification is the gate plus the structural match to
  `useClearFeatureReview` (which already invalidates both).
- Optional manual check (not required): with an MCP review set active, change it
  from the agent and confirm the inline reading surface updates without the ~3s lag.

## Done criteria

ALL must hold:

- [ ] The `feature-view` branch in `use-app-events.ts` invalidates both
      `utils.featureView` and `utils.featureReading` via `Promise.all`
- [ ] No bare `void promise` was introduced
- [ ] `pnpm verify` passes
- [ ] Only `use-app-events.ts` is modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `featureReading` no longer exists as a tRPC query (the reading surface was
  reworked since `b224765`) — report what replaced it.
- The `feature-view` branch already invalidates both (someone fixed it) — mark this
  plan DONE/REJECTED in the index with that note.

## Maintenance notes

- If a third feature surface is ever added (another consumer of the review set),
  this branch and `useClearFeatureReview` must both invalidate it — they are the
  two places that fan out a review-set change. Keep them in sync.
- A reviewer should confirm no over-invalidation crept in (only the two feature
  queries belong here).
