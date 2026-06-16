# Plan 017: Consolidate the layer-grouping logic and precompile its regexes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- src/main/flow.ts src/main/feature-view.ts src/main/feature-explore.ts`
> If any changed since this plan was written, compare the "Current state"
> excerpts against the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Category**: tech-debt / perf
- **Depends on**: none (the three grouping modules already have unit tests that
  pin the output; plan 016 is a nice-to-have safety net but not required)
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

The flow-layer grouping algorithm — "bucket files by `layerFor`, then emit groups
in declared layer order with `Other` last, files sorted by path" — is copy-pasted
in **three** modules (`buildFlow`, `buildFeatureView`, `buildExploreReading`), and
the `OTHER_LABEL = 'Other'` constant is re-declared in all three. This is exactly
the failure state `CLAUDE.md` hard rule 1 forbids ("one way to do everything"): a
change to grouping/ordering must be made in lockstep in three places, and there's
no single source of truth for the invariant.

Separately, `layerFor` constructs a fresh `RegExp` for **every layer on every
file** it's called with — with the 10 default layers and up to 200 changed files,
that's ~2000 regex compilations per flow build (and again per feature build). The
`flowCache`/`featureViewCache` memo means it isn't a per-poll cost, but every real
working-tree change pays ~10× the compilation it needs to.

After this plan: one generic `groupByLayer` helper, one exported `OTHER_LABEL`, and
the layer regexes compiled once per build instead of once per file. The three
modules' existing tests pin the behavior, so the refactor is verified by them
staying green.

## Current state

The three identical grouping blocks (modulo the row type `T`):

`src/main/flow.ts:129-143` (in `buildFlow`, `T = FlowFile`):

```ts
  const order = [...layers.map((l) => l.label), OTHER_LABEL]
  const groups = new Map<string, FlowFile[]>()
  for (const file of flowFiles) {
    const layer = layerFor(file.path, layers)
    const group = groups.get(layer) ?? []
    group.push(file)
    groups.set(layer, group)
  }
  return order
    .filter((layer) => groups.has(layer))
    .map((layer) => ({
      layer,
      files: (groups.get(layer) ?? []).sort((a, b) => a.path.localeCompare(b.path)),
    }))
```

`src/main/feature-view.ts:158-176` (in `buildFeatureView`, `T = FeatureFile`, with
its own `const OTHER_LABEL = 'Other'` at line 6, iterating `files.values()`).

`src/main/feature-explore.ts:206-219` (in `buildExploreReading`, `T = ReadingFile`,
with its own `const OTHER_LABEL = 'Other'` at line 14).

`layerFor` today recompiles per call (`src/main/flow.ts:27-42`):

```ts
const OTHER_LABEL = 'Other'

export function layerFor(path: string, layers: readonly Layer[]): string {
  let best: { label: string; index: number } | null = null
  for (const layer of layers) {
    const match = new RegExp(layer.pattern, 'g')   // ← compiled per layer per call
    let last: RegExpExecArray | null = null
    for (let m = match.exec(path); m !== null; m = match.exec(path)) last = m
    if (last && (best === null || last.index > best.index)) {
      best = { label: layer.label, index: last.index }
    }
  }
  return best?.label ?? OTHER_LABEL
}
```

`layerFor`'s "deepest (right-most) match wins" semantics rely on the `g` flag +
`exec` looping. The default layers are in `DEFAULT_LAYERS` (`src/main/flow.ts:12-23`).

Imports today: `feature-view.ts` imports `{ type Layer, layerFor, parseImports, resolveImport }`
from `./flow`; `feature-explore.ts` imports `{ type Layer, layerFor, parseImports }`
from `./flow`. Both have a private `OTHER_LABEL`.

Tests that pin the output (must stay green): `src/main/flow.test.ts`,
`src/main/feature-view.test.ts`, `src/main/feature-explore.test.ts`.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Install   | `pnpm install`   | exit 0              |
| Typecheck | `pnpm typecheck` | exit 0              |
| Test (flow area) | `pnpm test flow feature-view feature-explore` | all pass |
| Test (all) | `pnpm test`     | all pass            |
| Lint      | `pnpm lint`      | exit 0              |
| Build     | `pnpm build`     | exit 0              |

## Scope

**In scope**:
- `src/main/flow.ts` — add `groupByLayer` + `compileLayers`, export `OTHER_LABEL`,
  precompile in the matcher; use `groupByLayer` in `buildFlow`
- `src/main/feature-view.ts` — use `groupByLayer`, drop the local `OTHER_LABEL`
- `src/main/feature-explore.ts` — use `groupByLayer`, drop the local `OTHER_LABEL`
- `src/main/flow.test.ts` — add `groupByLayer` + `layerFor`-consistency tests

**Out of scope** (do NOT touch):
- The `parseImports`/`resolveImport`/`resolveRelativeImport` resolvers (a separate
  duplication — not this plan).
- The `layerFor` *semantics* (deepest-match-wins) — preserve exactly; only its
  internal compilation changes.
- The shapes of `FlowGroup`/`FeatureGroup`/`ReadingGroup` and the build functions'
  return types — unchanged.

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never branch**. Run the
full gate before committing. Conventional Commits; example:
`refactor(flow): one groupByLayer helper + precompiled layer regexes`.
Because this touches the documented flow architecture, ALSO do Step 5 (skill
update) per hard rule 4.

## Steps

### Step 1: Add `compileLayers` + a compiled matcher; keep `layerFor`'s signature

In `src/main/flow.ts`, `export const OTHER_LABEL = 'Other'` (was a private const),
then add a compiled-layer type + helpers and route `layerFor` through them:

```ts
export const OTHER_LABEL = 'Other'

interface CompiledLayer {
  label: string
  re: RegExp
}

/** Compile a layer set's patterns once (reuse across many `layerForCompiled` calls). */
export function compileLayers(layers: readonly Layer[]): CompiledLayer[] {
  return layers.map((layer) => ({ label: layer.label, re: new RegExp(layer.pattern, 'g') }))
}

function layerForCompiled(path: string, compiled: readonly CompiledLayer[]): string {
  let best: { label: string; index: number } | null = null
  for (const { label, re } of compiled) {
    re.lastIndex = 0 // `g` regexes are stateful — reset before each path scan
    let last: RegExpExecArray | null = null
    for (let m = re.exec(path); m !== null; m = re.exec(path)) last = m
    if (last && (best === null || last.index > best.index)) {
      best = { label, index: last.index }
    }
  }
  return best?.label ?? OTHER_LABEL
}

export function layerFor(path: string, layers: readonly Layer[]): string {
  return layerForCompiled(path, compileLayers(layers))
}
```

The `re.lastIndex = 0` reset is load-bearing: because the compiled regexes are now
reused across files, each scan must start from 0 (the old code created a fresh
regex per call, so `lastIndex` was always 0). Do not omit it.

**Verify**: `pnpm test flow` → existing `layerFor` tests still pass.

### Step 2: Add the generic `groupByLayer` helper

In `src/main/flow.ts`, add:

```ts
/**
 * Group files into flow layers: bucket by the deepest-matching layer, then emit
 * groups in declared layer order (with `Other` last), each file list sorted by
 * path. The ONE grouping implementation — shared by buildFlow, buildFeatureView,
 * and buildExploreReading.
 */
export function groupByLayer<T extends { path: string }>(
  items: readonly T[],
  layers: readonly Layer[],
): { layer: string; files: T[] }[] {
  const compiled = compileLayers(layers) // compile once for the whole batch
  const order = [...layers.map((l) => l.label), OTHER_LABEL]
  const byLayer = new Map<string, T[]>()
  for (const item of items) {
    const layer = layerForCompiled(item.path, compiled)
    const group = byLayer.get(layer) ?? []
    group.push(item)
    byLayer.set(layer, group)
  }
  return order
    .filter((layer) => byLayer.has(layer))
    .map((layer) => ({
      layer,
      files: (byLayer.get(layer) ?? []).sort((a, b) => a.path.localeCompare(b.path)),
    }))
}
```

Then replace the grouping block in `buildFlow` with:

```ts
  return groupByLayer(flowFiles, layers)
```

**Verify**: `pnpm test flow` → `buildFlow` tests still pass.

### Step 3: Use `groupByLayer` in `buildFeatureView`

In `src/main/feature-view.ts`:
- remove the private `const OTHER_LABEL = 'Other'` (line 6)
- update the import from `./flow` to include `groupByLayer` (and drop `layerFor`
  if it's no longer used in the file): e.g.
  `import { type Layer, groupByLayer, parseImports, resolveImport } from './flow'`
- replace the grouping block (`const order = …` through the `.map(...)`) at the end
  of `buildFeatureView` so the return becomes:

```ts
  return {
    name: params.name,
    fromAgent: params.reviewSet !== null,
    groups: groupByLayer([...files.values()], params.layers),
  }
```

**Verify**: `pnpm test feature-view` → still passes; `pnpm typecheck` → exit 0 (no
unused `OTHER_LABEL`/`layerFor`).

### Step 4: Use `groupByLayer` in `buildExploreReading`

In `src/main/feature-explore.ts`:
- remove the private `const OTHER_LABEL = 'Other'` (line 14)
- update the import from `./flow` to include `groupByLayer` (drop `layerFor` if
  unused): e.g. `import { type Layer, groupByLayer, parseImports } from './flow'`
- replace the grouping block (`const order = …` through the `groups` `.map(...)`)
  so the return becomes:

```ts
  const groups: ReadingGroup[] = groupByLayer(files, layers)
  return { name, groups }
```

(`files` here is the `ReadingFile[]` already built above the old grouping block.)

**Verify**: `pnpm test feature-explore` → still passes; `pnpm typecheck` → exit 0.

### Step 5: Add focused tests + record the consolidation

Add to `src/main/flow.test.ts`:

```ts
import { compileLayers, DEFAULT_LAYERS, groupByLayer, layerFor, OTHER_LABEL } from './flow'

describe('groupByLayer', () => {
  it('orders groups by declared layer with Other last and sorts files by path', () => {
    const items = [
      { path: 'src/services/b.ts' },
      { path: 'src/components/a.tsx' },
      { path: 'README.md' },
      { path: 'src/components/c.tsx' },
    ]
    const groups = groupByLayer(items, DEFAULT_LAYERS)
    expect(groups.map((g) => g.layer)).toEqual(['Components', 'Services', OTHER_LABEL])
    expect(groups[0]?.files.map((f) => f.path)).toEqual([
      'src/components/a.tsx',
      'src/components/c.tsx',
    ])
  })
})

describe('compileLayers + layerFor parity', () => {
  it('layerFor matches a precompiled scan', () => {
    const path = 'apps/api/controllers/x.ts'
    expect(layerFor(path, DEFAULT_LAYERS)).toBe('Controllers')
  })
})
```

Then, per hard rule 4, append a dateless bullet to `.agents/skills/history/SKILL.md`:

> - **Flow grouping consolidated** (advisor plan 017): the bucket-by-`layerFor`,
>   order-with-`Other`-last, sort-by-path block was copy-pasted in `buildFlow`,
>   `buildFeatureView`, and `buildExploreReading` (each re-declaring `OTHER_LABEL`).
>   Extracted to one generic `groupByLayer` in `flow.ts` (exported `OTHER_LABEL`);
>   `layerFor` now compiles each layer regex once per batch (`compileLayers` +
>   `layerForCompiled`, with a `lastIndex` reset) instead of once per file.

And update the `architecture` skill's flow note to mention the single
`groupByLayer` helper (find the "Flow-ordered review" bullet in
`.agents/skills/architecture/SKILL.md` and add a short clause that grouping is the
shared `groupByLayer` in `flow.ts`).

**Verify**: `pnpm test flow` → all pass including the new cases.

### Step 6: Run the full gate

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.

## Test plan

- New `flow.test.ts` cases: `groupByLayer` order/sort + a `layerFor` parity check.
- The decisive verification is that the EXISTING `flow.test.ts`,
  `feature-view.test.ts`, and `feature-explore.test.ts` cases pass unchanged — they
  pin the grouping/order/sort output, so a behavior-preserving refactor keeps them
  green.
- Verification: `pnpm test flow feature-view feature-explore` → all pass; `pnpm test`
  → full suite green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0; existing flow/feature/explore tests pass; new
      `groupByLayer` tests pass
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -rn "OTHER_LABEL = 'Other'" src/main` shows exactly ONE definition
      (in `flow.ts`)
- [ ] `grep -n "groupByLayer" src/main/flow.ts src/main/feature-view.ts src/main/feature-explore.ts`
      shows it used in all three builders
- [ ] `grep -n "new RegExp(layer.pattern" src/main/flow.ts` appears only inside
      `compileLayers` (not in a per-file loop)
- [ ] The `history` and `architecture` skills are updated
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any existing `flow.test.ts` / `feature-view.test.ts` / `feature-explore.test.ts`
  case fails — the refactor changed observable behavior; the grouping must be
  byte-for-byte equivalent. Re-check the `lastIndex` reset and the `[...files.values()]`
  ordering (Map iteration order = insertion order; preserve it).
- `layerFor` is used somewhere you can't see from these three files in a way that
  the signature change would break (it keeps its signature here, so it should not).

## Maintenance notes

- For the reviewer: the one risk is the `re.lastIndex = 0` reset — without it,
  reused `g`-flag regexes skip matches and grouping silently breaks. Confirm it's
  present in `layerForCompiled`. Confirm Map insertion order is preserved so the
  within-layer pre-sort input is deterministic (the final `.sort` makes it moot,
  but keep parity).
- Future grouping/ordering changes now happen in exactly one place
  (`groupByLayer`); the three builders just call it.
