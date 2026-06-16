# Plan 022: Build branch/base-diff review — a scope toggle on the Changes tab

> **Build plan** following the maintainer's decision on plan 006: surface **option
> (a)** — a "Working tree ↔ Branch" scope toggle on the Changes tab — with
> **auto-detected default-branch base** (no base-ref picker in v1; that's a
> documented fast-follow). The 006 spike already landed the range data-layer
> helpers (`gitMergeBase`, `gitRangeChangedFiles`, `gitRangeDiffFile`) on this
> branch; this plan adds the rest and wires the UI.
>
> **Planned at** commit `4b67dea` (branch `improve/execute-all`, based on `main`
> `cbdee99`). This plan is meant to be executed IN that worktree branch, stacking
> on the 006 prototype.

## Status

- **Priority**: P1 (maintainer-selected build)
- **Effort**: L (~12 files; touches the diff/tab model)
- **Risk**: LOW–MED (additive; the working-tree path is untouched and parallel)
- **Depends on**: 006 prototype helpers (already committed: `gitMergeBase`,
  `gitRangeChangedFiles`, `gitRangeDiffFile` in `src/main/git.ts`).
- **Category**: direction / build

## Why this matters

See plan 006 + `plans/006-branch-base-diff-review.notes.md`. Agents commit as they
work, so by review time the Changes tab is empty and the feature is scattered
across commits. This adds a **Branch** scope to the Changes tab: the flow-ordered
cumulative diff since the merge-base with the default branch, with per-file diffs
across that range. The flow grouping, the diff renderer, and the list UI are all
reused — this is the wiring that makes "review the whole branch as a story" real.

## Design (decided)

- **Range**: committed-only (`mergeBase..HEAD`). The 006 helpers already do this.
- **Base**: auto-detected default branch (`origin/HEAD` → local `main`/`master`).
  No picker in v1.
- **Freshness**: a committed range is static until the next commit, so the branch
  query does NOT poll (unlike `gitFlow`); it's invalidated on commit.
- **Diff correctness**: a committed file has NO working-tree diff, so in Branch
  mode the row-click MUST open the file's **range** diff, not `gitDiffFile`. This
  is why the diff tab gains an optional `base`.
- **No new pattern**: scope lives in `usePreferencesStore` (like `diffMode`); the
  toggle is a shadcn `ToggleGroup` (like `diff-mode-toggle.tsx`); the data hook
  mirrors `use-git-flow.ts`; the procedure forks `gitFlow`. Nothing here introduces
  a new state/UI/IPC pattern (hard rules 1 & 5 satisfied).

## Commands

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Full gate before commit:
`pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Deps already installed in
this worktree.

## Scope

**In scope** (modify/create):
- `src/main/git.ts` — add `gitDefaultBranch` + `gitRangeNumstat`.
- `src/main/git.test.ts` — test both (extend the existing `range diff prototype` temp-repo).
- `src/main/api.ts` — add `gitRangeFlow` + `gitRangeDiffFile` procedures.
- `src/renderer/src/stores/preferences.ts` — add `changesScope` + `setChangesScope`.
- `src/renderer/src/stores/tabs.ts` — add optional `base?: string` to `Tab`.
- `src/renderer/src/hooks/use-diff.ts` — `useDiffFile`/`useDiffFilePrefetch` accept optional `base`.
- `src/renderer/src/hooks/use-branch-flow.ts` — **create**; the branch-flow domain hook.
- `src/renderer/src/hooks/use-commit.ts` — invalidate `gitRangeFlow` on commit success.
- `src/renderer/src/components/git/changes-scope-toggle.tsx` — **create**; the toggle.
- `src/renderer/src/components/git/changes-list.tsx` — render the toggle, pick the hook by scope, thread `base` to `FileRow` + the range diff tab.
- `src/renderer/src/components/viewer/diff-view.tsx` — accept + use `base`.
- `src/renderer/src/components/shell/viewer.tsx` — pass `activeTab.base` to `DiffView`, key by `path:base`.
- `src/renderer/src/components/git/changes-list.test.tsx` — toggle + branch-mode cases.

**Out of scope** (do NOT touch):
- The working-tree `gitFlow` / `useGitFlow` / `gitDiffFile` paths — leave EXACTLY as
  is; the branch path is additive and parallel.
- The 006 prototype helpers — reuse, don't modify.
- A base-ref picker / branch-list procedure — explicitly deferred (no `gitBranches`
  list exists; adding it is the v2 fast-follow).
- `feature-list.tsx`, the Feature view — out of scope (that's option (c), not chosen).

## Current state (exact, from this worktree)

`useGitFlow` (`src/renderer/src/hooks/use-git-flow.ts`) — the hook to mirror:
```ts
export function useGitFlow(): { groups: FlowGroup[] | undefined; refresh: () => Promise<void> } {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const { data: groups, refetch } = trpc.gitFlow.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    staleTime: 0,
    refetchInterval: 3000,
  })
  const refresh = async (): Promise<void> => {
    await Promise.all([refetch(), utils.gitDiffFile.invalidate()])
  }
  return { groups, refresh }
}
```

`gitFlow` procedure (`src/main/api.ts`) — the procedure to fork (memoizes via
`flowKey`, reads each changed file's source ≤1 MB, calls `buildFlow`, merges
numstat). Read it in full; `gitRangeFlow` is the same with `gitRangeChangedFiles` +
`gitRangeNumstat` instead of `gitStatus` + `gitNumstat`.

`gitNumstat` (`src/main/git.ts:111`) — the numstat to mirror (working tree:
`git diff HEAD --numstat -z` → `parseNumstat`). `gitMergeBase`,
`gitRangeChangedFiles`, `gitRangeDiffFile` already exist (006).

`DiffModeToggle` (`src/renderer/src/components/git/diff-mode-toggle.tsx`) — the
toggle exemplar:
```tsx
export function DiffModeToggle(): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const setDiffMode = usePreferencesStore((s) => s.setDiffMode)
  return (
    <ToggleGroup value={[diffMode]} onValueChange={(value: string[]) => {
      const mode = value[0]
      if (mode === 'unified' || mode === 'split') setDiffMode(mode)
    }}>
      <ToggleGroupItem value="unified" size="sm">Unified</ToggleGroupItem>
      <ToggleGroupItem value="split" size="sm">Split</ToggleGroupItem>
    </ToggleGroup>
  )
}
```

`useDiffFile` (`src/renderer/src/hooks/use-diff.ts`) — gains an optional `base`:
```ts
export function useDiffFile(filePath: string): { hunks: DiffHunk[] | undefined; error: { message: string } | null } {
  const repo = useRepoStore((s) => s.repo)
  const { data: hunks, error } = trpc.gitDiffFile.useQuery(
    { repoPath: repo?.path ?? '', filePath },
    { enabled: repo !== null, staleTime: 0, placeholderData: keepPreviousData },
  )
  return { hunks, error }
}
```

`Tab` (`src/renderer/src/stores/tabs.ts`): `{ id, kind, title, path, line?, symbol?, preview? }`.
`tabId(kind, key)` ⇒ `` `${kind}:${key}` ``.

FileRow's diff-open (`changes-list.tsx`): `onClick` →
`openTab({ id: tabId('diff', file.path), kind: 'diff', title: name, path: file.path })`,
`onMouseEnter={() => prefetchDiff(file.path)}`.

`PaneView` diff branch (`viewer.tsx`, after plan 013):
`case 'diff': return <DiffView key={activeTab.path} filePath={activeTab.path} />`.

`usePreferencesStore` (`preferences.ts`): `persist((set) => ({...}), { name: 'porcelain-preferences' })`
with no partialize (whole state persisted). Mode fields like `diffMode: 'unified'`
with `setDiffMode: (diffMode) => set({ diffMode })`. Types like
`type DiffMode = 'unified' | 'split'` near the top.

## Steps

### Step 1 — `git.ts` helpers + tests

Add to `src/main/git.ts`:
```ts
/**
 * The base ref a branch review is measured against: the remote's default branch
 * (origin/HEAD, e.g. "origin/main") if known, else a local main/master.
 */
export async function gitDefaultBranch(repoPath: string): Promise<string> {
  try {
    const ref = (await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'origin/HEAD'])).trim()
    if (ref && ref !== 'origin/HEAD') return ref
  } catch {
    // no remote / origin/HEAD unset — fall through to local heuristics
  }
  for (const candidate of ['main', 'master']) {
    try {
      await runGit(repoPath, ['rev-parse', '--verify', '--quiet', candidate])
      return candidate
    } catch {
      // not present; try next
    }
  }
  return 'main' // last resort; range is empty if it doesn't exist
}

/** +/- counts per file over the merge-base of `base`..HEAD range. */
export async function gitRangeNumstat(repoPath: string, base: string): Promise<DiffStat[]> {
  const mergeBase = await gitMergeBase(repoPath, base)
  return parseNumstat(await runGit(repoPath, ['diff', '--numstat', '-z', `${mergeBase}..HEAD`]))
}
```
(`parseNumstat`, `DiffStat`, `gitMergeBase` are already imported/defined.)

In `src/main/git.test.ts`, extend the existing `range diff prototype` describe (it
already builds a `main`→`feature` temp repo). Add:
- `gitDefaultBranch(repoDir)` resolves to `'main'` (no remote, local `main` exists).
- `gitRangeNumstat(repoDir, 'main')` returns the `base.ts` + `feature.ts` counts
  (assert `base.ts` has additions ≥1 and deletions ≥1, `feature.ts` additions ≥1).

**Verify**: `pnpm test -- git` → new cases pass.

### Step 2 — `api.ts` procedures

Add `gitDefaultBranch`, `gitRangeChangedFiles`, `gitRangeDiffFile`, `gitRangeNumstat`
to the existing `./git` import. Add a `rangeFlowCache` Map alongside `flowCache`.

`gitRangeFlow` — fork `gitFlow`, returning `{ groups, base }`:
```ts
gitRangeFlow: t.procedure
  .input(z.string())
  .query(async ({ input }): Promise<{ groups: FlowGroup[]; base: string }> => {
    const base = await gitDefaultBranch(input)
    try {
      const [files, config, stats] = await Promise.all([
        gitRangeChangedFiles(input, base),
        loadConfig(),
        gitRangeNumstat(input, base),
      ])
      const layers = layersFor(config, input) ?? DEFAULT_LAYERS
      const key = `${base}\n${flowKey(files, stats, layers)}`
      const cached = rangeFlowCache.get(input)
      if (cached && cached.key === key) return { groups: cached.groups, base }
      const sources = new Map<string, string>()
      await Promise.all(
        files.slice(0, 200).map(async (file) => {
          try {
            const content = await readFile(join(input, file.path), 'utf8')
            if (content.length < 1024 * 1024) sources.set(file.path, content)
          } catch {
            // deleted-in-range files have no working-tree source to parse
          }
        }),
      )
      const statByPath = new Map(stats.map((s) => [s.path, s]))
      const groups = buildFlow(files, sources, layers).map((group) => ({
        ...group,
        files: group.files.map((file) => ({
          ...file,
          additions: statByPath.get(file.path)?.additions,
          deletions: statByPath.get(file.path)?.deletions,
        })),
      }))
      rangeFlowCache.set(input, { key, groups })
      return { groups, base }
    } catch {
      // no resolvable base / merge-base failure → empty range, not a crash
      return { groups: [], base }
    }
  }),
```
(Match the exact `flowCache` type/shape used by `gitFlow` for `rangeFlowCache`.)

`gitRangeDiffFile` procedure (the helper exists):
```ts
gitRangeDiffFile: t.procedure
  .input(z.object({ repoPath: z.string(), base: z.string(), filePath: z.string() }))
  .query(({ input }) => gitRangeDiffFile(input.repoPath, input.base, input.filePath)),
```

**Verify**: `pnpm typecheck` → exit 0 (the AppRouter type updates).

### Step 3 — preferences: `changesScope`

In `preferences.ts`: add `type ChangesScope = 'working' | 'branch'` (near the other
mode types), `changesScope: ChangesScope` to the interface + `setChangesScope`,
default `changesScope: 'working'`, and `setChangesScope: (changesScope) => set({ changesScope })`.
(Whole state is persisted, so no partialize change needed.)

**Verify**: `pnpm typecheck` → exit 0.

### Step 4 — `Tab.base`

In `tabs.ts`, add to the `Tab` interface:
```ts
  /** Diff tabs only: the range base ref. Omitted ⇒ a working-tree diff. */
  base?: string
```
No other tabs.ts change (the addTab/preview logic keys off `id`, which the openers
will make base-distinct in Step 8).

**Verify**: `pnpm typecheck` → exit 0.

### Step 5 — `use-diff.ts` optional base

Extend `useDiffFile` and `useDiffFilePrefetch` to take an optional `base`. When
`base` is set, query `gitRangeDiffFile` ({ repoPath, base, filePath }); else
`gitDiffFile` as today. Keep `useCommitDiff` unchanged. Example for `useDiffFile`:
```ts
export function useDiffFile(filePath: string, base?: string): { hunks: DiffHunk[] | undefined; error: { message: string } | null } {
  const repo = useRepoStore((s) => s.repo)
  const working = trpc.gitDiffFile.useQuery(
    { repoPath: repo?.path ?? '', filePath },
    { enabled: repo !== null && base === undefined, staleTime: 0, placeholderData: keepPreviousData },
  )
  const range = trpc.gitRangeDiffFile.useQuery(
    { repoPath: repo?.path ?? '', base: base ?? '', filePath },
    { enabled: repo !== null && base !== undefined, staleTime: Infinity, placeholderData: keepPreviousData },
  )
  const active = base === undefined ? working : range
  return { hunks: active.data, error: active.error }
}
```
(Two `useQuery` calls with mutually-exclusive `enabled` is the idiomatic
conditional-query shape here — both hooks always run, only one is enabled. Do the
analogous thing for `useDiffFilePrefetch(filePath, base?)`: prefetch the matching
procedure.)

**Verify**: `pnpm typecheck` → exit 0.

### Step 6 — `use-branch-flow.ts` (new)

```ts
import type { FlowGroup } from '@main/flow'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/**
 * The Changes tab's Branch scope: the flow-ordered cumulative diff since the
 * merge-base with the default branch. A committed range is static until the next
 * commit, so — unlike useGitFlow — this does NOT poll; use-commit invalidates it.
 */
export function useBranchFlow(enabled: boolean): {
  groups: FlowGroup[] | undefined
  base: string | undefined
  refresh: () => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const { data, refetch } = trpc.gitRangeFlow.useQuery(repo?.path ?? '', {
    enabled: enabled && repo !== null,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const refresh = async (): Promise<void> => {
    await refetch()
  }
  return { groups: data?.groups, base: data?.base, refresh }
}
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 7 — invalidate on commit

In `use-commit.ts`, the commit mutation's `onSuccess` already invalidates
`gitFlow`/`gitLog`/`gitCommitConventions`. Add `utils.gitRangeFlow.invalidate()`
there (a new commit moves HEAD, changing the range). Use `await` /
`Promise.all([...])` consistent with the surrounding code (no `void`).

**Verify**: `pnpm typecheck` → exit 0.

### Step 8 — diff view + PaneView carry `base`

`diff-view.tsx`: give `DiffView` an optional `base?: string` prop and pass it to
`useDiffFile(filePath, base)`. (Read the file; add the prop to its props type and
thread it — change nothing else.)

`viewer.tsx` `PaneView` diff case (currently keyed by path per plan 013):
```tsx
    case 'diff':
      return (
        <DiffView
          key={`${activeTab.path}:${activeTab.base ?? ''}`}
          filePath={activeTab.path}
          base={activeTab.base}
        />
      )
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 9 — the toggle + Changes-list wiring

Create `src/renderer/src/components/git/changes-scope-toggle.tsx`, mirroring
`diff-mode-toggle.tsx`:
```tsx
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { usePreferencesStore } from '@renderer/stores/preferences'

export function ChangesScopeToggle(): React.JSX.Element {
  const changesScope = usePreferencesStore((s) => s.changesScope)
  const setChangesScope = usePreferencesStore((s) => s.setChangesScope)
  return (
    <ToggleGroup
      value={[changesScope]}
      onValueChange={(value: string[]) => {
        const scope = value[0]
        if (scope === 'working' || scope === 'branch') setChangesScope(scope)
      }}
    >
      <ToggleGroupItem value="working" size="sm">Working</ToggleGroupItem>
      <ToggleGroupItem value="branch" size="sm">Branch</ToggleGroupItem>
    </ToggleGroup>
  )
}
```

In `changes-list.tsx`:
1. `ChangesList`: read `const changesScope = usePreferencesStore((s) => s.changesScope)`.
   Call BOTH hooks (hooks can't be conditional):
   `const working = useGitFlow()` and
   `const branch = useBranchFlow(changesScope === 'branch')`.
   Then select: `const { groups, refresh } = changesScope === 'branch' ? branch : working`
   and `const base = changesScope === 'branch' ? branch.base : undefined`.
2. Render `<ChangesScopeToggle />` in the header (next to the existing count/refresh).
   When in branch mode, show the base in the count line, e.g.
   `{total} changed · vs {base}` (only when `base`); keep the existing
   `· {reviewedCount} reviewed` clause working (it operates on the active `groups`).
3. Pass `base` to each `FileRow` (`<FileRow … base={base} />`).
4. `FileRow`: accept `base?: string`. In its diff-open `onClick` and
   `onMouseEnter`, when `base` is set, open/prefetch the RANGE diff:
   - id: `tabId('diff', base ? `${base}:${file.path}` : file.path)`
   - tab object includes `base` (so `Tab.base` is set; omit when undefined)
   - `prefetchDiff(file.path, base)`
   Keep the working-tree behavior identical when `base` is undefined.

The `loading` guard: in branch mode `groups` is `undefined` until the query
resolves — the existing `groups === undefined` "Loading…" guard already covers it.

**Verify**: `pnpm typecheck && pnpm lint` → exit 0.

### Step 10 — tests

In `changes-list.test.tsx` (mock the new hooks the same way the file mocks the
others — `vi.mock('@renderer/hooks/use-branch-flow', ...)` and add `changesScope`
to the preferences-store setup). Add cases:
- The scope toggle renders (a "Branch" toggle item is present).
- With `changesScope: 'branch'` and `useBranchFlow` returning groups + a base, the
  branch groups render and the header shows `vs <base>`.
- A FileRow click in branch mode opens a diff tab whose `base` is set and whose id
  includes the base (spy on `openTab`).
Keep all existing cases green (they're working-tree scope; the default
`changesScope` is `'working'`, so they're unaffected — set it explicitly in the
existing `beforeEach` if needed).

**Verify**: `pnpm test -- changes-list git` → all pass.

### Step 11 — full gate

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.

## Done criteria

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all exit 0.
- [ ] `gitDefaultBranch` + `gitRangeNumstat` exist + tested; `gitRangeFlow` +
      `gitRangeDiffFile` procedures exist (`grep -n` in api.ts).
- [ ] `usePreferencesStore` has `changesScope` + `setChangesScope`.
- [ ] `Tab` has optional `base`; `useDiffFile`/`useDiffFilePrefetch` accept `base`
      and route to `gitRangeDiffFile` when set; `DiffView` passes it; `PaneView`
      keys the diff by `path:base`.
- [ ] `useBranchFlow` exists (no poll); `use-commit` invalidates `gitRangeFlow`.
- [ ] The Changes tab shows a Working/Branch toggle; Branch mode lists the range,
      shows `vs <base>`, and a row-click opens that file's RANGE diff (a distinct
      tab from the working-tree diff).
- [ ] New tests for the helpers + the toggle/branch-mode surface pass; existing
      tests stay green.
- [ ] No out-of-scope files modified; the working-tree `gitFlow`/`gitDiffFile`
      paths are byte-unchanged.

## STOP conditions

Stop and report (do not improvise) if:
- `gitFlow` / `useGitFlow` / the `Tab` interface / `useDiffFile` no longer match the
  "Current state" excerpts (drift beyond what's expected on this branch).
- `ToggleGroup`/`ToggleGroupItem` don't exist in `components/ui/toggle-group` with
  the `value`/`onValueChange` API shown — re-read `diff-mode-toggle.tsx` for the
  real API.
- Threading `base` would force a change to a working-tree path (it must not — the
  working-tree diff is `base === undefined`, byte-identical to today).
- Any existing `changes-list.test.tsx` case fails for a reason other than the new
  preferences/hook mock setup.

## Maintenance notes

- **Fast-follow (v2): the base-ref picker.** Add a `gitBranches` list procedure +
  a dropdown (mirror `project-switcher.tsx`) so the user can review against any
  ref, not just the auto-detected default. The range layer (`gitRangeFlow` takes a
  resolved base internally today) would take the base as input instead.
- The reviewed flag (plan 008) and the flow grouping work in both scopes unchanged
  because both are path-keyed / input-agnostic.
- Watch in review: that Branch mode's row-click opens the RANGE diff (not an empty
  working-tree diff), and that the working-tree scope is untouched.
