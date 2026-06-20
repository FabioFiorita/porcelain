# Plan 012: Share one feature build between `featureView` and `featureReading`

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/main/api.ts`
> If `api.ts` changed since this plan was written, compare against "Current state";
> on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (but landing **plan 009/011** first is harmless)
- **Category**: perf
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

When an agent has pushed a review set, **two** procedures poll the feature every 3
seconds — `featureView` (the sidebar Feature list) and `featureReading` (the inline
reading surface) — and **each independently** runs `buildFeatureFromGather`, the
heaviest recurring main-process work: reading up to 200 working-tree files into a
source map, expanding import context, and building the view. They cache separately
(`featureViewCache` and `featureReadingCache`) on the **same** key, so on every
working-tree change during an agent loop the expensive build runs **twice** for the
identical snapshot. Sharing one build between them halves that cost in agent mode
(the primary workflow). In the no-agent baseline `featureReading` returns `null`
without building, so there's no duplication to remove there — this only helps when a
review set is present, which is exactly when it's hot.

## Current state

`src/main/api.ts`. The shared phases (already factored):
```ts
async function gatherFeature(input) { /* gitStatus+loadConfig+gitNumstat+gitListFiles+readReviewSet → { …, key } */ }
async function buildFeatureFromGather(input, g): Promise<{ view: FeatureView; sources: Map<string,string> }> {
  /* reads ≤200 sources + context, builds view; returns view AND sources */
}
```
The two caches and procedures:
```ts
const featureViewCache = new Map<string, { key: string; view: FeatureView }>()
const featureReadingCache = new Map<string, { key: string; reading: FeatureReading }>()

featureView: t.procedure.input(z.string()).query(async ({ input }) => {
  const g = await gatherFeature(input)
  const cached = featureViewCache.get(input)
  if (cached && cached.key === g.key) return cached.view
  const { view } = await buildFeatureFromGather(input, g)   // <-- build #1
  featureViewCache.set(input, { key: g.key, view })
  return view
}),

featureReading: t.procedure.input(z.string()).query(async ({ input }) => {
  const g = await gatherFeature(input)
  if (!g.reviewSet) return null
  const cached = featureReadingCache.get(input)
  if (cached && cached.key === g.key) return cached.reading
  const { view, sources } = await buildFeatureFromGather(input, g)  // <-- build #2 (same snapshot!)
  /* … builds diffs for changed files, then buildFeatureReading({ view, sources, diffs }) … */
  featureReadingCache.set(input, { key: g.key, reading })
  return reading
}),
```
`buildFeatureFromGather` is deterministic for a given `g` (the key encodes
status+numstat+layers+reviewSet), so its `{ view, sources }` output can be safely
shared across the two procedures within the same key.

## The fix

Replace `featureViewCache` with a shared **build** cache keyed on the feature key,
holding `{ view, sources }`, and have both procedures read it through one helper.
Keep `featureReadingCache` for the reading-specific result (it additionally runs
`gitDiffFile` per changed file + `buildFeatureReading`, which `featureView` doesn't
need, so caching the reading separately avoids re-running diffs on a no-op poll).

```ts
// One shared build per snapshot — both feature procedures reuse it instead of each
// re-reading ≤200 sources and rebuilding the view for the identical key.
const featureBuildCache = new Map<string, { key: string; view: FeatureView; sources: Map<string, string> }>()

async function getFeatureBuild(input: string, g: Awaited<ReturnType<typeof gatherFeature>>) {
  const cached = featureBuildCache.get(input)
  if (cached && cached.key === g.key) return cached
  const { view, sources } = await buildFeatureFromGather(input, g)
  const entry = { key: g.key, view, sources }
  featureBuildCache.set(input, entry)
  return entry
}
```
- `featureView`: `const g = await gatherFeature(input); return (await getFeatureBuild(input, g)).view`
- `featureReading`: `const g = await gatherFeature(input); if (!g.reviewSet) return null;`
  check `featureReadingCache` (unchanged); on a miss
  `const { view, sources } = await getFeatureBuild(input, g)` (reuses `featureView`'s
  build), then build `diffs` + `buildFeatureReading` + cache as today.

Net: `buildFeatureFromGather` runs **once** per snapshot regardless of which
procedure polls first. `gatherFeature` still runs per-procedure (it's the cheap
phase — leave it; deduping it across procedures is out of scope).

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Typecheck | `pnpm typecheck`     | exit 0 |
| Tests     | `pnpm test`          | all pass |
| Lint      | `pnpm lint`          | exit 0 |
| Full gate | `pnpm verify`        | all four pass |

## Scope

**In scope**:
- `src/main/api.ts` — replace `featureViewCache` with `featureBuildCache` + the
  `getFeatureBuild` helper; rewire both feature procedures.

**Out of scope** (do NOT touch):
- `gatherFeature` / `buildFeatureFromGather` internals — reuse them as-is.
- `featureReadingCache` — keep it (the reading adds diff work worth caching separately).
- `flowCache` / `rangeFlowCache` — unrelated.
- The renderer hooks (`use-feature-view.ts` / `use-feature-reading.ts`) — the query
  shapes are unchanged; no client change.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `perf(feature): share one build between featureView and featureReading`.
- Do NOT push unless instructed.

## Steps

### Step 1: Add `featureBuildCache` + `getFeatureBuild`

Add them near the other feature caches. Remove `featureViewCache` (it's superseded).

### Step 2: Rewire `featureView`

Replace its body with the `getFeatureBuild` version (returns `.view`).

### Step 3: Rewire `featureReading`

Keep the `if (!g.reviewSet) return null` short-circuit and the `featureReadingCache`
check; on a miss, obtain `{ view, sources }` from `getFeatureBuild(input, g)` and
proceed with the existing diffs + `buildFeatureReading` + cache.

**Verify**: `pnpm typecheck` → exit 0 (the `FeatureView`/`FeatureReading` return
types are unchanged).

### Step 4: Full gate

**Verify**: `pnpm verify` → all four pass.

## Test plan

- `api.ts` procedures have no unit harness today (they compose git + Electron
  `shell`), so verification is the gate plus the structural invariants below. The
  existing `feature-view.test.ts` (which tests `buildFeatureView` directly) must
  still pass — the build logic is unchanged, only *who calls it* changes.
- Optional manual check (dev app, agent mode): with an MCP review set active, open
  the Feature list and the inline read simultaneously and confirm both still render
  identically and update on a working-tree change. (A render-equality check is the
  real proof that sharing didn't change output.)

## Done criteria

ALL must hold:

- [ ] `featureViewCache` is gone; a single `featureBuildCache` + `getFeatureBuild`
      serve both procedures
- [ ] `featureReading` still returns `null` when there's no review set, and still
      caches its reading via `featureReadingCache`
- [ ] `pnpm typecheck` exits 0; the `featureView`/`featureReading` return types are unchanged
- [ ] `pnpm verify` passes
- [ ] Only `api.ts` is modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `buildFeatureFromGather` turns out **not** to be deterministic for a given `g`
  (e.g. it reads time/random or mutates shared state) — sharing would be unsafe;
  report it.
- The `featureReading` build needs something from the gather that the shared build
  doesn't carry (it currently needs `view` + `sources`, both returned) — report the
  gap.

## Maintenance notes

- If a third consumer of the feature build appears, route it through
  `getFeatureBuild` too — that's the point of the shared cache.
- This cache is keyed per `repoPath` and never evicted (same class as the other
  module caches — acceptable for one-repo-per-window; see the perf note in the prior
  audit). Don't add eviction here unless the other caches get it too.
- A reviewer should confirm the two surfaces still render identical data (the
  sharing must be transparent).
