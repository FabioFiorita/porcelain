# Plan 020: Flow-group a historical commit's files (CommitView reads as a story)

> **Executor instructions**: This is an **enhancement** of the existing `CommitView`
> that reuses the shipped flow engine — it is NOT a new feature/tab kind. Follow step
> by step. Run every verification command. If a "STOP condition" occurs (especially
> the source-read design decision in Step 1), stop and report. When done, update this
> plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/main/api.ts src/main/git.ts src/main/flow.ts src/renderer/src/components/git/commit-view.tsx`
> If any changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction (enhancement of an existing view)
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

Porcelain's headline capability is "review changes as a story" — files grouped along
their dependency flow (entry-point → data) instead of an alphabetical list. That
works for **uncommitted** work (`gitFlow`) and **branch ranges** (`gitRangeFlow`), but
a **landed commit** — the common "what shipped here?" case opened from the History
tab — drops back to a **flat, alphabetical** file list in `CommitView`. The flow
engine (`groupByLayer`/`buildFlow` in `flow.ts`), the layer config, and a single
commit's files/diffs are all already shipped; flow-grouping a commit is essentially
wiring them together. This makes the History review experience match the rest of the
app, with no new screen.

## Current state

`src/renderer/src/components/git/commit-view.tsx` — the master list is flat (lines ~39–53):
```tsx
{files.map((file) => (
  <button key={file.path} onClick={() => setSelected(file.path)} …>{file.path}</button>
))}
```
`files` comes from `useCommitFiles(hash)` (a thin hook over the `gitCommitFiles`
procedure). The right pane (`CommitFileDiff` → `useCommitDiff` → `gitCommitDiff`) is
fine and stays.

Main-process pieces that already exist:
- `git.ts`: `gitCommitFiles(repoPath, hash): Promise<ChangedFile[]>` and
  `gitCommitDiff(repoPath, hash, filePath)`. `gitNumstat` exists for the working tree
  but there is **no** per-commit numstat helper yet.
- `flow.ts`: `buildFlow(files, sources, layers)` → `FlowGroup[]` (`{ layer, files }`),
  the same function `gitFlow`/`gitRangeFlow` use.
- `api.ts`: `gitFlow` and `gitRangeFlow` show the exact pattern — read sources for up
  to 200 files (`readFile` of the working tree), `buildFlow`, attach +/- stats, cache
  on a key. `layersFor(config, repoPath) ?? DEFAULT_LAYERS` provides the layers.

How the Changes list renders groups (the pattern to mirror in CommitView) —
`changes-list.tsx`: `groups.map(group => <label>{group.layer}</label> + group.files.map(...))`.

## The design decision you MUST resolve first (Step 1)

`buildFlow` takes `sources` (file contents) to compute import "connects" edges; the
layer grouping itself is mostly **path-based** (`layersFor` patterns), so sources are
a *bonus* (richer edges), not required for grouping. For a **historical** commit the
files may have changed or been deleted since, so there are two options for sources:
- **(A) Working-tree approximation** — read current `readFile(join(repo, path))`, exactly
  like `gitRangeFlow` does for a historical range. Simple, consistent with existing
  code, best-effort (missing files just yield fewer connect edges). **Recommended for
  v1.**
- **(B) At-commit contents** — `git show <hash>:<path>`. More correct for old commits,
  but a new read path. Defer unless (A) visibly mis-groups.

Pick **(A)** unless you have a reason not to; note the choice in the PR. If (A) looks
wrong on an old commit during manual testing, STOP and raise (B) as a follow-up.

## Commands you will need

| Purpose   | Command                       | Expected on success |
|-----------|-------------------------------|---------------------|
| Tests     | `pnpm test -- git flow commit`| pass (incl. new numstat test) |
| Typecheck | `pnpm typecheck`              | exit 0 |
| Lint      | `pnpm lint`                   | exit 0 |
| Full gate | `pnpm verify`                 | all four pass |

## Scope

**In scope**:
- `src/main/git.ts` — add `gitCommitNumstat(repoPath, hash): Promise<DiffStat[]>`
- `src/main/git.test.ts` — test `gitCommitNumstat` (reuse the temp-repo harness)
- `src/main/api.ts` — add a `gitCommitFlow` procedure (mirror `gitRangeFlow`)
- `src/renderer/src/hooks/use-history.ts` (or a new `use-commit-flow.ts`) — a
  `useCommitFlow(hash)` hook over the new procedure
- `src/renderer/src/components/git/commit-view.tsx` — render the master list grouped by
  flow layer instead of flat alphabetical

**Out of scope** (do NOT touch):
- The diff pane (`CommitFileDiff` / `gitCommitDiff`) — unchanged.
- `gitFlow` / `gitRangeFlow` — reuse their pattern; do not refactor them here (the
  prior audit's "share the flow pipeline" cleanup is a separate item).
- Adding a new `TabKind` — there is none; `commit` already exists. This stays an
  enhancement of the existing commit view.
- The flow engine (`flow.ts`) — reuse `buildFlow` as-is.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `feat(history): flow-group a commit's files like the rest of the app`.
- Do NOT push unless instructed.

## Steps

### Step 1: Decide sources approach (see "The design decision") and add `gitCommitNumstat`

Add to `git.ts`:
```ts
/** +/- counts per file for a single commit (vs its first parent; root commit vs empty tree). */
export async function gitCommitNumstat(repoPath: string, hash: string): Promise<DiffStat[]> {
  return parseNumstat(await runGit(repoPath, ['show', '--numstat', '--format=', '-z', hash]))
}
```
Verify the `git show --numstat --format= -z` output parses cleanly through
`parseNumstat` (the same parser `gitNumstat` uses). Handle the root commit (no parent)
— `git show` produces numstat-vs-empty-tree there; confirm it doesn't throw.

Test it in `git.test.ts` using the existing temp-repo harness (commit a known change,
assert the +/- counts).

### Step 2: Add the `gitCommitFlow` procedure

In `api.ts`, mirror `gitRangeFlow` (cache included). Sketch:
```ts
const commitFlowCache = new Map<string, { key: string; groups: FlowGroup[] }>()

gitCommitFlow: t.procedure
  .input(z.object({ repoPath: z.string(), hash: z.string() }))
  .query(async ({ input }): Promise<FlowGroup[]> => {
    const [files, config, stats] = await Promise.all([
      gitCommitFiles(input.repoPath, input.hash),
      loadConfig(),
      gitCommitNumstat(input.repoPath, input.hash),
    ])
    const layers = layersFor(config, input.repoPath) ?? DEFAULT_LAYERS
    const cacheKey = `${input.repoPath}\n${input.hash}`
    const key = `${input.hash}\n${flowKey(files, stats, layers)}` // hash is immutable, so this is stable
    const cached = commitFlowCache.get(cacheKey)
    if (cached && cached.key === key) return cached.groups
    const sources = new Map<string, string>()
    await Promise.all(files.slice(0, 200).map(async (file) => {
      try {
        const content = await readFile(join(input.repoPath, file.path), 'utf8')  // option (A): working-tree
        if (content.length < 1024 * 1024) sources.set(file.path, content)
      } catch { /* file no longer in the working tree — grouping still works by path */ }
    }))
    const statByPath = new Map(stats.map((s) => [s.path, s]))
    const groups = buildFlow(files, sources, layers).map((group) => ({
      ...group,
      files: group.files.map((file) => ({ ...file,
        additions: statByPath.get(file.path)?.additions,
        deletions: statByPath.get(file.path)?.deletions })),
    }))
    commitFlowCache.set(cacheKey, { key, groups })
    return groups
  }),
```
(A commit hash is immutable, so this cache effectively never busts for the same
commit — that's correct.) Import `gitCommitNumstat` alongside the other git imports.

### Step 3: Add a `useCommitFlow(hash)` hook

Mirror `useCommitFiles`/`useFeatureView` in the renderer hooks. Since a commit is
immutable, set `staleTime: Infinity` and **no** `refetchInterval` (unlike the live
`gitFlow`). Return `{ groups }`.

### Step 4: Render the master list grouped by flow layer

In `commit-view.tsx`, drive the master list from `useCommitFlow(hash)` and render
groups (layer label + the files under it) instead of the flat `files.map`. Keep the
existing `selected`/`CommitFileDiff` master-detail behavior — clicking a file in any
group still opens its diff in the right pane. If `groups` is undefined, keep the
existing "Loading…" state. Reuse the layer-label + row styling from `changes-list.tsx`
for visual consistency (a small inline grouped list is fine — do not pull in the full
`FileRow`, which has working-tree-only actions like discard/stage that don't apply to
a historical commit).

**Verify**: `pnpm typecheck` → exit 0.

### Step 5: Full gate + manual check

**Verify**: `pnpm verify` → all four pass.
**Verify (manual, recommended)**: in `pnpm dev`, open a commit from the History tab;
the file list is grouped by flow layer (entry-point → data), and clicking a file shows
its diff. Try an old commit to sanity-check option (A) doesn't look wrong.

## Test plan

- `git.test.ts`: `gitCommitNumstat` returns correct +/- for a known commit (temp-repo
  harness), incl. the root commit not throwing.
- `gitCommitFlow`/the hook/CommitView aren't easily unit-tested (git + render); the
  gate + the manual check are the verification. Optionally add a `commit-view.test.tsx`
  that mocks `useCommitFlow` to return two groups and asserts both layer labels render
  (model on `changes-list.test.tsx`'s hook-mock pattern).

## Done criteria

ALL must hold:

- [ ] `gitCommitNumstat` exists and is tested
- [ ] A `gitCommitFlow` procedure returns `FlowGroup[]` for a commit (cached on the immutable hash)
- [ ] `useCommitFlow(hash)` exists with `staleTime: Infinity`, no poll
- [ ] `CommitView`'s master list is grouped by flow layer; clicking a file still opens its diff
- [ ] The sources approach (A or B) is chosen and noted in the PR
- [ ] `pnpm verify` passes; the manual History-tab check works
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `git show --numstat --format= -z` output does NOT parse through `parseNumstat`
  cleanly (e.g. format differs) — report the actual output; the helper's git args may
  need adjusting.
- Option (A) visibly mis-groups an old commit (files renamed/deleted since) badly
  enough to mislead — STOP and raise option (B) (`git show hash:path`) as the fix
  rather than shipping wrong grouping.
- Reusing `FileRow` tempts you to expose discard/stage on a historical commit — don't;
  those are working-tree actions. Render a read-only grouped list.

## Maintenance notes

- `gitFlow`/`gitRangeFlow`/`gitCommitFlow` now share the same "read ≤200 sources →
  buildFlow → attach stats" body three times — the prior audit's "share the flow
  pipeline" cleanup (SC3) becomes more worthwhile after this; consider factoring it in
  a follow-up once this lands.
- If at-commit source reads (option B) are adopted later, thread them through the same
  `readSourcesInto`-style helper.
- A reviewer should confirm the commit view stays read-only (no working-tree mutations
  leak into a historical-commit surface).
