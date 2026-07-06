# Plan 026: One working-tree snapshot per poll tick (dedupe the 3s git spawns)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- src/backend/api.ts src/backend/git.ts src/backend/feature-key.ts src/backend/layers-store.ts src/backend/review-store.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/025-unify-persistence-factories.md (the `'mtime'` channel cache)
- **Category**: perf
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

Porcelain's perf bar is "fast on a 50 GB monorepo", and its liveness model is a
3-second poll. Today one tick with the Feature surfaces open runs `git status
--porcelain -uall` and `git diff HEAD --numstat` **two to three times each**
(once per polling procedure), re-reads and re-zod-parses `layers.json` and
`review-sets.json` on each of those calls, and builds a `JSON.stringify` of the
full parsed status/numstat arrays per call just to *check* a cache. On a big
repo, `git status -uall` (untracked enumeration) is the dominant recurring cost
— paying it 3× per tick is pure waste. A previous plan (old 012, shipped)
already dedupes the expensive *build* via `getFeatureBuild`; this plan dedupes
the *gather* that feeds it.

## Current state

Three procedures poll on 3s intervals (renderer hooks:
`use-git-flow.ts:13` `refetchInterval: 3000`, `use-feature-view.ts:12` same,
`use-feature-reading.ts:20` same; `use-git-flow.ts:28` also polls `gitStatus`
at 5000 for the sidebar badge).

`gitFlow` spawns its own pair, `src/backend/api.ts:638-651`:

```ts
gitFlow: t.procedure.input(z.string()).query(async ({ input }): Promise<FlowGroup[]> => {
  const [files, stored, stats] = await Promise.all([
    gitStatus(input),
    readLayers(input),
    gitNumstat(input),
  ])
  const layers = stored ?? DEFAULT_LAYERS
  const key = flowKey(files, stats, layers)
  const cached = flowCache.get(input)
  if (cached && cached.key === key) return cached.groups
  ...
```

`featureView` and `featureReading` EACH call `gatherFeature` independently,
`api.ts:251-262` and `api.ts:685-688`, `695-698`:

```ts
async function gatherFeature(input: string) {
  const [files, stored, stats, repoFiles, reviewSet] = await Promise.all([
    gitStatus(input),
    readLayers(input),
    gitNumstat(input),
    gitListFiles(input),     // cached (stale-while-revalidate) — fine
    readReviewSet(input),
  ])
  const layers = stored ?? DEFAULT_LAYERS
  const key = featureKey(files, stats, layers, reviewSet)
  return { files, stats, layers, reviewSet, repoFiles, key }
}
```

So a tick with the Feature tab open = 2× `gitStatus` + 2× `gitNumstat` (+1 each
when a Changes surface also mounts `gitFlow`), plus ~4 uncached
`readLayers`/`readReviewSet` file reads (plan 025's mtime cache fixes those).

The cache keys stringify the full parsed arrays on every call — even on hits,
[src/backend/feature-key.ts](../src/backend/feature-key.ts) (whole file):

```ts
export function flowKey(files, stats, layers): string {
  return JSON.stringify([files, stats, layers])
}
export function featureKey(files, stats, layers, reviewSet): string {
  return JSON.stringify([files, stats, layers, reviewSet])
}
```

Related, small: the finder's derived candidate cache keys on **array identity**,
`api.ts:341-354` (`cached.files === files`), but the file-list
stale-while-revalidate replaces the array wholesale even when content didn't
change — `src/backend/git.ts:46-56`:

```ts
async function refreshFileList(repoPath: string): Promise<string[]> {
  const out = await runGit(repoPath, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  const files = out.split('\0').filter(Boolean)
  fileListCache.set(repoPath, { files, at: Date.now(), refreshing: false })   // new identity every refresh
  return files
}
```

Perf invariants that must hold (audit skill §Performance — re-read before
starting): git queries stay LIVE (a 1s-scale memo under a 3s poll is fine; a
30s cache is not), `flowCache` keeps returning the SAME `groups` reference on a
hit (renderer referential stability), and the fs watcher events
(`working-tree`) must still cause the next poll to see fresh data.

Repo conventions: pure logic in its own `src/backend/<thing>.ts` with a sibling
test; impure edges injected for testability (exemplar:
`findTailscaleAddress(interfaces = networkInterfaces())` in
`src/backend/tailnet.ts:15-17`).

## Commands you will need

| Purpose   | Command                            | Expected on success |
|-----------|------------------------------------|---------------------|
| Targeted  | `pnpm test -- working-tree`        | all pass (new file) |
| Backend   | `pnpm test -- src/backend`         | all pass            |
| Full gate | `pnpm verify`                      | exit 0              |

## Scope

**In scope**:
- `src/backend/working-tree.ts` (create) + `src/backend/working-tree.test.ts` (create)
- `src/backend/api.ts` (wire `gitFlow`/`gatherFeature` through the snapshot; fix `searchCandidates` keying if Step 4 chooses that side)
- `src/backend/git.ts` (identity-preserving refresh, Step 4)
- `src/backend/feature-key.ts` (only if Step 3's measured need is confirmed)

**Out of scope**:
- `getFeatureBuild` / `featureBuildCache` / `flowCache` semantics — already
  correct; don't restructure them.
- The renderer hooks' poll intervals — 3000ms is a product decision.
- `gitRangeFlow`/`gitCommitFlow` — range/commit flows poll against refs, not the
  working tree; different inputs, low duplication. Leave them.
- Any change to what the snapshot *contains* beyond status+numstat.

## Git workflow

- Commit straight to `main` (branch creation hook-blocked; `pnpm verify`
  hook-enforced). Do NOT push.
- Message style: `perf: coalesce the 3s poll's git status/numstat into one shared working-tree snapshot per tick`

## Steps

### Step 1: The snapshot module

Create `src/backend/working-tree.ts`: a per-repo memo that coalesces concurrent
callers onto ONE in-flight `Promise` and serves it for a short TTL (1000ms —
strictly under the 3s poll so no tick ever sees data older than the previous
tick):

```ts
export interface WorkingTreeSnapshot {
  files: ChangedFile[]
  stats: DiffStat[]
}

export function workingTreeSnapshot(
  repoPath: string,
  fetch: () => Promise<WorkingTreeSnapshot> = defaultFetch(repoPath),
): Promise<WorkingTreeSnapshot>
```

Implementation notes:
- Module-level `Map<repoPath, { at: number; promise: Promise<WorkingTreeSnapshot> }>`.
- A caller within TTL of `at` (or while the promise is still pending) gets the
  same promise; otherwise a fresh fetch replaces the entry.
- A **rejected** fetch must evict the entry (don't cache errors for the TTL).
- `defaultFetch` = `Promise.all([gitStatus(repoPath), gitNumstat(repoPath)])` —
  inject `fetch` for tests, matching the `tailnet.ts` injectable-impure pattern.
- Export a `clearWorkingTreeSnapshot(repoPath)` for mutation paths if Step 2's
  audit (below) finds a same-tick read-after-write; otherwise the 1s TTL is the
  only invalidation and mutations rely on invalidated queries refetching on the
  NEXT tick — which is ≤1s stale, within the current UX (the old behavior could
  also serve a just-pre-mutation status to a concurrent poller).

**Verify**: `pnpm test -- working-tree` → new tests pass (see Test plan).

### Step 2: Wire the three consumers

In `api.ts`, replace the `gitStatus(input)`/`gitNumstat(input)` pairs in
`gitFlow` (`:638-651`) and `gatherFeature` (`:251-262`) with one
`workingTreeSnapshot(input)` call each (destructure `files`/`stats`).
`readLayers`/`readReviewSet`/`gitListFiles` stay as they are (025's cache covers
the first two).

**Mutation audit** (do this, record the answer in the commit message): grep
`api.ts` for mutations that invalidate flow-affecting queries
(`gitStageFile`, `gitCommit`, `writeTextFile`, quick commands…). These
invalidate on the RENDERER (hooks' `onSuccess`), which triggers an immediate
refetch — that refetch may now hit a ≤1s-old snapshot from before the mutation.
If the immediate refetch showing pre-mutation state for one tick is observable
in tests/UX, call `clearWorkingTreeSnapshot(repoPath)` inside the relevant
`api.ts` mutations (staging, commit, write, quick command) — it's a one-line,
cheap correctness valve. Recommended: add the clear calls; they cost nothing.

**Verify**: `pnpm test -- src/backend` → pass. Manual spot-check (optional but
cheap): `pnpm dev`, open the playground repo, Feature tab; in a terminal run
`while true; do pgrep -fl "git status" ; sleep 0.5; done` and confirm one
status spawn per ~3s, not three.

### Step 3: Cheapen the cache keys (measured, conditional)

The stringify keys now run once per tick (Step 2), which removes most of the
waste. Before touching `feature-key.ts`, measure: generate a synthetic 10k-entry
`ChangedFile[]`/`DiffStat[]` in a scratch test and time `flowKey`. If it's
< 5ms, SKIP this step and record "not worth it at current scale" in the plan
status row. If it's material, change `flowKey`/`featureKey` to accept the raw
porcelain/numstat stdout strings (have `workingTreeSnapshot` retain them
alongside the parsed arrays) and key on those + a layers/review-set stamp —
update `flow.test.ts`/`feature-key.test.ts` accordingly.

**Verify**: `pnpm test -- feature-key flow` → pass either way.

### Step 4: Identity-preserving file-list refresh

In `git.ts` `refreshFileList` (`:46-56`) and `refreshSearchList` (`:99-116`):
after building the new `files` array, if the cached entry exists and the
content is identical (same length + every element equal — a linear scan is fine
here, it already allocated the array), keep the OLD array object in the cache
entry (update `at`/`refreshing` only). This keeps `searchCandidates`'
identity-keyed memo (`api.ts:347-348`) valid across no-op refreshes.

**Verify**: `pnpm test -- git` → pass (add the case to `git.test.ts` if the
file-list helpers are covered there; if they aren't testable without a fixture
repo, the existing fixture-repo pattern in `git.test.ts` is the model — STOP if
no such pattern exists).

### Step 5: Full gate

**Verify**: `pnpm verify` → exit 0.

## Test plan

`src/backend/working-tree.test.ts` (new), with an injected fake `fetch`:

1. two concurrent calls share one fetch (fetch called once, same resolved object)
2. a call after TTL expiry re-fetches
3. a call within TTL serves the cached snapshot (fetch not called again)
4. a rejected fetch evicts — the next call re-fetches instead of re-throwing the cached rejection
5. `clearWorkingTreeSnapshot` forces the next call to re-fetch
6. two different repoPaths don't share entries

Use `vi.useFakeTimers()` for TTL cases. Pattern: any small backend test
(e.g. `src/backend/feature-key.test.ts`) for shape; no fs needed.

## Done criteria

- [ ] `pnpm verify` exits 0
- [ ] `grep -c "gitStatus(input)" src/backend/api.ts` shows the count dropped by ≥2
      (only non-poll callers remain, e.g. the `gitStatus` procedure itself)
- [ ] `pnpm test -- working-tree` → 6 tests pass
- [ ] `flowCache` hit still returns the identical `groups` reference
      (existing behavior — confirm no test regressed)
- [ ] Step 3's measurement recorded (either the change or the "skipped, <Nms" note)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The "Current state" excerpts don't match (especially if someone already added
  a snapshot layer).
- Plan 025 has not landed (no `'mtime'` cache on `readLayers`) — this plan still
  works but record that the channel-read half of the win is missing; proceed
  with the git half only if instructed, otherwise wait for 025.
- The mutation audit in Step 2 finds a flow that *reads its own write in the
  same request* (not via renderer refetch) — that's a semantic change; report.

## Maintenance notes

- The TTL (1000ms) and the poll (3000ms) are coupled: if the poll interval ever
  drops below ~1.5s, shrink the TTL with it.
- A future fs-watch-driven invalidation (`working-tree` watcher events already
  exist) could replace the TTL entirely — deferred because the watcher covers
  only open files' dirs, not the whole tree.
- Reviewer should scrutinize: error eviction (test 4) and that
  `clearWorkingTreeSnapshot` is called from every mutating procedure that used
  to be followed by an immediate fresh status.
