# Plan 013: Compute the range merge-base once per branch-flow build

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/main/git.ts src/main/git.test.ts src/main/api.ts`
> If any changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

Building the branch-range flow re-resolves the same `git merge-base` **twice**:
`gitRangeChangedFiles` and `gitRangeNumstat` each call `gitMergeBase(repoPath, base)`
internally, and `gitRangeFlow` calls both. On a 50 GB monorepo a `merge-base` walk
against `origin/main` is a non-trivial process spawn, and doing it twice for one
build is pure waste. This is a correctness-preserving refactor: compute the
merge-base once and pass the resolved SHA to both range reads. (The branch flow does
not poll, so this isn't a per-tick cost — it's paid on scope-switch to Branch and on
each commit invalidation — but it's a clean, zero-risk reduction.)

## Current state

`src/main/git.ts`:
```ts
export async function gitMergeBase(repoPath, base): Promise<string> {
  return (await runGit(repoPath, ['merge-base', base, 'HEAD'])).trim()
}
export async function gitRangeChangedFiles(repoPath, base): Promise<ChangedFile[]> {
  const mergeBase = await gitMergeBase(repoPath, base)       // spawn #1
  return parseNameStatus(await runGit(repoPath, ['diff','--name-status','-z','--no-color',`${mergeBase}..HEAD`]))
}
export async function gitRangeNumstat(repoPath, base): Promise<DiffStat[]> {
  const mergeBase = await gitMergeBase(repoPath, base)       // spawn #2 (same value)
  return parseNumstat(await runGit(repoPath, ['diff','--numstat','-z',`${mergeBase}..HEAD`]))
}
```
`src/main/api.ts` — `gitRangeFlow`:
```ts
const base = await gitDefaultBranch(input)
const [files, config, stats] = await Promise.all([
  gitRangeChangedFiles(input, base),   // resolves merge-base
  loadConfig(),
  gitRangeNumstat(input, base),        // resolves merge-base AGAIN
])
```
`git.test.ts` already tests the public `gitRangeChangedFiles` / `gitRangeNumstat` /
`gitMergeBase` against a temp repo — those tests must keep passing.

## The fix

Extract the SHA-taking inner work into exported `*From(mergeBase)` helpers; keep the
existing public `(repoPath, base)` helpers as thin wrappers that resolve the
merge-base once and delegate (so their tested signatures and behavior are
unchanged). Then `gitRangeFlow` resolves the merge-base **once** and calls the
`*From` variants.

```ts
// git.ts
export async function gitRangeChangedFilesFrom(repoPath: string, mergeBase: string): Promise<ChangedFile[]> {
  return parseNameStatus(await runGit(repoPath, ['diff','--name-status','-z','--no-color',`${mergeBase}..HEAD`]))
}
export async function gitRangeChangedFiles(repoPath: string, base: string): Promise<ChangedFile[]> {
  return gitRangeChangedFilesFrom(repoPath, await gitMergeBase(repoPath, base))
}
export async function gitRangeNumstatFrom(repoPath: string, mergeBase: string): Promise<DiffStat[]> {
  return parseNumstat(await runGit(repoPath, ['diff','--numstat','-z',`${mergeBase}..HEAD`]))
}
export async function gitRangeNumstat(repoPath: string, base: string): Promise<DiffStat[]> {
  return gitRangeNumstatFrom(repoPath, await gitMergeBase(repoPath, base))
}
```
```ts
// api.ts gitRangeFlow
const base = await gitDefaultBranch(input)
const mergeBase = await gitMergeBase(input, base)
const [files, config, stats] = await Promise.all([
  gitRangeChangedFilesFrom(input, mergeBase),
  loadConfig(),
  gitRangeNumstatFrom(input, mergeBase),
])
```
Update the `api.ts` import from `git.ts` to bring in `gitMergeBase`,
`gitRangeChangedFilesFrom`, `gitRangeNumstatFrom` (and drop the now-unused
`gitRangeChangedFiles`/`gitRangeNumstat` imports there **only if** they're not used
elsewhere in `api.ts` — check first).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Tests     | `pnpm test -- git`       | range tests still pass |
| Typecheck | `pnpm typecheck`         | exit 0 |
| Lint      | `pnpm lint`              | exit 0 |
| Full gate | `pnpm verify`            | all four pass |

## Scope

**In scope**:
- `src/main/git.ts` (add `*From` helpers; wrappers delegate)
- `src/main/api.ts` (`gitRangeFlow` resolves merge-base once; update imports)

**Out of scope** (do NOT touch):
- `gitRangeDiffFile` (per-file-open) — it also recomputes the merge-base, but
  threading the SHA there ripples to the renderer (`use-diff`, the `base` it passes).
  Leave it; note it in maintenance.
- `gitDefaultBranch` caching — separate concern (it's called once per build, not
  duplicated); out of scope.
- Any change to the `merge-base`/`diff` git arguments — keep them byte-identical so
  the parse output is unchanged.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `perf(git): resolve the range merge-base once per branch-flow build`.
- Do NOT push unless instructed.

## Steps

### Step 1: Add the `*From` helpers and make the wrappers delegate

Edit `git.ts` per "The fix". The public `gitRangeChangedFiles`/`gitRangeNumstat`
keep identical behavior (resolve once, delegate).

### Step 2: Resolve once in `gitRangeFlow`

Edit `api.ts` `gitRangeFlow` to compute `mergeBase` once and call the `*From`
variants. Update the import list.

### Step 3: Verify the range tests still pass

**Verify**: `pnpm test -- git` → the existing `gitRangeChangedFiles` /
`gitRangeNumstat` / `gitMergeBase` / `gitRangeDiffFile` cases pass unchanged.

### Step 4: Full gate

**Verify**: `pnpm verify` → all four pass.

## Test plan

- No new behavior, so the existing `git.test.ts` range-diff prototype is the proof
  (it asserts the same files/stats/diff the wrappers produce — unchanged).
- Optional: add a one-line test that `gitRangeChangedFilesFrom(repo, await gitMergeBase(repo,'main'))`
  equals `gitRangeChangedFiles(repo,'main')` (delegation parity), reusing the
  existing temp repo.

## Done criteria

ALL must hold:

- [ ] `gitRangeFlow` calls `gitMergeBase` **once** and uses `gitRangeChangedFilesFrom`
      / `gitRangeNumstatFrom` (`grep -n "gitMergeBase" src/main/api.ts` shows one call in `gitRangeFlow`)
- [ ] Public `gitRangeChangedFiles` / `gitRangeNumstat` behavior is unchanged (their tests pass)
- [ ] `pnpm verify` passes
- [ ] Only `git.ts` and `api.ts` are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `gitRangeChangedFiles` / `gitRangeNumstat` are imported/used by code **other** than
  `gitRangeFlow` that would behave differently if you changed them (you shouldn't —
  you're keeping the wrappers) — but if you find an unexpected caller, note it.
- The range tests change output after the refactor (they must not) — investigate;
  the `*From` variant must produce byte-identical git args.

## Maintenance notes

- Follow-up (deferred): `gitRangeDiffFile` recomputes the merge-base on every file
  open in branch scope. Threading the resolved SHA from `gitRangeFlow` through the
  renderer (`base` → merge-base SHA) would remove that too, but it ripples into the
  diff hook — do it only if branch-scope file-opening is measured as slow.
- `gitDefaultBranch` is also re-spawned per build (1–3 `rev-parse`s); a session cache
  is possible but the default branch can change mid-session (a remote is added), so
  cache carefully or leave it.
