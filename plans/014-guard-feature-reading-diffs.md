# Plan 014: Guard per-file diff reads in `featureReading`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- src/main/api.ts`
> If `src/main/api.ts` changed since this plan was written, compare the "Current
> state" excerpt against the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Category**: bug
- **Depends on**: none
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

The `featureReading` procedure (the MCP-only inline reading surface) reads each
changed file's working-tree diff in a single `Promise.all`. If any one
`gitDiffFile` rejects — e.g. a file was renamed/deleted between the `gitStatus`
snapshot and this read, or an untracked path momentarily resolves to a directory —
the whole `Promise.all` rejects, the entire `featureReading` query throws, and the
reading surface renders nothing until the working tree changes again. The sibling
source-read loops (`readSourcesInto`, `gitFlow`'s inline read) already `try/catch`
per file so one bad file doesn't poison the batch; this loop is the odd one out.

After this plan, a single failed diff read yields an empty hunk list for that one
file (matching the existing `?? []` fallback the reader already tolerates) instead
of blanking the whole feature reading.

## Current state

`featureReading` in `src/main/api.ts:451-471`, the unguarded loop:

```ts
      const diffs = new Map<string, DiffHunk[]>()
      await Promise.all(
        changed.map(async (file) => {
          diffs.set(file.path, await gitDiffFile(input, file.path))
        }),
      )
      const reading = buildFeatureReading({ view, sources, diffs })
```

The consumer already treats a missing/empty diff gracefully —
`buildFeatureReading` does `hunks: params.diffs.get(file.path) ?? []`
(`src/main/feature-view.ts:235`). The sibling pattern to mirror is
`readSourcesInto` (`src/main/api.ts:130-140`), which wraps each per-file read in a
`try/catch` and simply skips on failure.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Install   | `pnpm install`   | exit 0              |
| Typecheck | `pnpm typecheck` | exit 0              |
| Test (all) | `pnpm test`     | all pass            |
| Lint      | `pnpm lint`      | exit 0              |
| Build     | `pnpm build`     | exit 0              |

## Scope

**In scope**:
- `src/main/api.ts` — wrap the per-file diff read in `featureReading`.

**Out of scope** (do NOT touch):
- `buildFeatureReading` / `feature-view.ts` — it already handles missing diffs.
- `gitDiffFile` / `git.ts` — do not change the diff reader itself.
- The cache key / memoization — unchanged.

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never branch**. Run the
full gate before committing. Conventional Commits; example:
`fix(api): tolerate a single failed diff read in featureReading`.

## Steps

### Step 1: Wrap each diff read so one failure doesn't reject the batch

In `featureReading`, change the loop to catch per file (leave the file out of the
`diffs` map on failure; the reader falls back to `[]`):

```ts
      const diffs = new Map<string, DiffHunk[]>()
      await Promise.all(
        changed.map(async (file) => {
          try {
            diffs.set(file.path, await gitDiffFile(input, file.path))
          } catch {
            // file vanished/renamed between the status snapshot and this read —
            // leave it out; buildFeatureReading falls back to an empty hunk list
          }
        }),
      )
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Run the full gate

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.

## Test plan

- `api.ts` has no unit test today (see plan 016, which adds characterization
  tests for this module). This change is a small, self-evidently-correct
  robustness wrap mirroring the existing `readSourcesInto` pattern, so it does not
  block on new tests here.
- If plan 016 has already landed, add a case to `api.test.ts` that injects a
  failing `gitDiffFile` for one changed file and asserts `featureReading` still
  returns a reading (with that file's `hunks` empty) rather than throwing. If 007
  has not landed, record this as a follow-up in the maintenance notes (do not block).
- Verification: `pnpm test` → full suite green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -n "catch" src/main/api.ts` shows the new catch inside the
      `featureReading` diff loop
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `featureReading` loop no longer matches the "Current state" excerpt.
- You discover `buildFeatureReading` requires every changed file to be present in
  `diffs` (it does not today — it uses `?? []` — but verify before relying on it).

## Maintenance notes

- For the reviewer: confirm the catch is empty-on-purpose (a vanished file legit-
  imately has no diff) and that `buildFeatureReading`'s `?? []` fallback covers it.
- Follow-up (deferred): once plan 016 lands, add the injected-failure test
  described in the Test plan.
