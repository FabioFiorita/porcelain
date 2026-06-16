# Plan 015: Stop `gitGrep` from swallowing real failures as "no matches"

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- src/main/git.ts src/main/git.test.ts`
> If `src/main/git.ts` changed since this plan was written, compare the "Current
> state" excerpt against the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Category**: bug
- **Depends on**: none
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

`gitGrep` (the backend for Find references / text search) wraps its whole
`git grep` invocation in `catch { return [] }` with the comment "git grep exits 1
when nothing matches." But exit 1 is only the *no-match* code — `git grep` returns
exit codes ≥2 for real errors (bad pathspec, killed process, `maxBuffer`
overflow), and a missing `git` binary rejects with a non-numeric `code`. All of
those are currently swallowed and rendered to the user as "no matches," so a
genuinely failed search is indistinguishable from an empty one and can't be
diagnosed.

After this plan, only the documented no-match exit code (1) returns `[]`; any
other failure surfaces git's error output instead of silently showing zero
results.

## Current state

`gitGrep` in `src/main/git.ts:228-246`:

```ts
const MAX_GREP_MATCHES = 500

/** Literal text search across tracked + untracked files; empty on no matches. */
export async function gitGrep(repoPath: string, query: string): Promise<GrepMatch[]> {
  try {
    const out = await runGit(repoPath, [
      'grep',
      '-n',
      '-I',
      '--untracked',
      '--fixed-strings',
      '-e',
      query,
    ])
    return parseGrep(out).slice(0, MAX_GREP_MATCHES)
  } catch {
    return [] // git grep exits 1 when nothing matches
  }
}
```

The module already has an error-formatting helper, `gitErrorOutput(error)`
(`src/main/git.ts:123-133`), used by the mutation wrappers to throw git's stderr.
`execFileAsync` rejects with an error whose `.code` is the process exit code
(a number) for non-zero exits.

Existing tests for this module live in `src/main/git.test.ts` (today it tests
`quickCommandArgs`); it imports named exports from `./git` and uses inline
`describe`/`it`. Match that style.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Install   | `pnpm install`   | exit 0              |
| Typecheck | `pnpm typecheck` | exit 0              |
| Test (this) | `pnpm test git`  | all pass incl. new cases |
| Test (all) | `pnpm test`     | all pass            |
| Lint      | `pnpm lint`      | exit 0              |
| Build     | `pnpm build`     | exit 0              |

## Scope

**In scope**:
- `src/main/git.ts` — add a pure `isNoMatchError` helper and use it in `gitGrep`
- `src/main/git.test.ts` — unit-test `isNoMatchError`

**Out of scope** (do NOT touch):
- The `git grep` args/flags — unchanged (`-e query` already passes the query as a
  value, not an option; keep it).
- Other `try/catch { return [] }` sites — `gitGrep` is the one this plan targets.

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never branch**. Run the
full gate before committing. Conventional Commits; example:
`fix(git): only swallow git grep's no-match exit, surface real errors`.

## Steps

### Step 1: Add a pure `isNoMatchError` helper

In `src/main/git.ts`, add (and `export`, so it's unit-testable) above `gitGrep`:

```ts
/**
 * `git grep` exits 1 when there are simply no matches — that's not a failure.
 * Any other exit code (or a non-exit error like a missing binary) IS a real
 * problem and must not be hidden as "no results".
 */
export function isNoMatchError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: unknown }).code === 1
  )
}
```

(If the repo bans the `as { code: unknown }` shape under its no-cast rule, use a
narrowing helper instead — e.g. read `code` via a `'code' in error` guard and a
local `const code = (error as Record<string, unknown>).code` is also a cast; prefer
`Reflect.get(error, 'code') === 1` if needed. Confirm `pnpm lint`/`pnpm typecheck`
pass either way.)

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Use it in `gitGrep`

```ts
export async function gitGrep(repoPath: string, query: string): Promise<GrepMatch[]> {
  try {
    const out = await runGit(repoPath, [
      'grep',
      '-n',
      '-I',
      '--untracked',
      '--fixed-strings',
      '-e',
      query,
    ])
    return parseGrep(out).slice(0, MAX_GREP_MATCHES)
  } catch (error) {
    if (isNoMatchError(error)) return [] // exit 1 = no matches, not a failure
    throw new Error(gitErrorOutput(error))
  }
}
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Unit-test the helper

In `src/main/git.test.ts`, add:

```ts
import { isNoMatchError, quickCommandArgs } from './git'

describe('isNoMatchError', () => {
  it('treats exit code 1 as no-match', () => {
    expect(isNoMatchError({ code: 1 })).toBe(true)
  })
  it('treats other exit codes and errors as real failures', () => {
    expect(isNoMatchError({ code: 2 })).toBe(false)
    expect(isNoMatchError({ code: 'ENOENT' })).toBe(false)
    expect(isNoMatchError(new Error('boom'))).toBe(false)
    expect(isNoMatchError(null)).toBe(false)
  })
})
```

(Keep the existing `quickCommandArgs` import/tests; just add the new `describe`.)

**Verify**: `pnpm test git` → all pass including the new cases.

### Step 4: Run the full gate

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.

## Test plan

- New `isNoMatchError` unit tests in `src/main/git.test.ts` (exit 1 → true; exit
  2 / `'ENOENT'` / plain Error / null → false).
- Pattern: the existing `quickCommandArgs` describe block in the same file.
- `gitGrep` itself shells out to `git`, so it's not unit-tested here (consistent
  with the module's current coverage); the helper carries the testable logic.
- Verification: `pnpm test git` → all pass; `pnpm test` → full suite green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0; `isNoMatchError` cases exist and pass
- [ ] `pnpm lint` exits 0 (no banned `any`/cast escape hatch)
- [ ] `pnpm build` exits 0
- [ ] `grep -n "isNoMatchError" src/main/git.ts` shows it used in `gitGrep`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Satisfying the no-cast rule for reading `error.code` proves impossible without an
  `as`/`any` (report the exact lint error; the repo bans both — there is a
  guard-based way, so report rather than disabling the rule).
- `gitGrep` no longer matches the "Current state" excerpt.

## Maintenance notes

- For the reviewer: confirm exit 1 still returns `[]` (the SearchView must keep
  showing an empty result for genuine no-matches) and that only ≥2/other errors
  now throw.
- The thrown error propagates to the `searchText` query; confirm the search view
  renders query errors acceptably (it already has an `error` channel via its hook).
