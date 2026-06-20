# Plan 017: Collapse the repeated git try/catch into a `runGitChecked` wrapper

> **Executor instructions**: Follow step by step. Run every verification command and
> confirm the expected result. If a "STOP condition" occurs, stop and report. When
> done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/main/git.ts`
> If `git.ts` changed since this plan was written, compare against "Current state";
> on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/009-characterize-git-mutations.md (land first)
- **Category**: tech-debt
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

The mutating git helpers each repeat the identical wrapper:
```ts
try {
  await runGit(repoPath, [...])
} catch (error) {
  throw new Error(gitErrorOutput(error))
}
```
copy-pasted ~10 times. One `runGitChecked(repoPath, args)` that does the try/catch
once removes the repetition and guarantees every mutation surfaces git's own error
text uniformly (so the UI shows git's refusal, e.g. "local changes would be
overwritten"). Pure refactor — no behavior change.

**Why it depends on plan 009**: plan 009 adds characterization tests for these exact
helpers. Land 009 first so its suite proves the argv and error behavior are identical
before and after this refactor.

## Current state

`src/main/git.ts` — the duplicated pattern appears in (at least): `gitCheckout`
(~242), `gitStageAll` (~263), `gitUnstageAll` (~272), `gitStageFile` (~283),
`gitUnstageFile` (~290), `gitRestoreFromHead` (~316), `gitResetPath` (~330),
`gitCommit` (~338). Each calls `runGit` inside a `try` and rethrows
`new Error(gitErrorOutput(error))`. `runGit` and `gitErrorOutput` are already in the
file:
```ts
async function runGit(repoPath, args): Promise<string> { /* execFile git, GIT_OPTIONAL_LOCKS=0 */ }
function gitErrorOutput(error: unknown): string { /* stderr ?? stdout ?? String(error) */ }
```
Find every occurrence with:
`grep -n "throw new Error(gitErrorOutput(error))" src/main/git.ts`

## The wrapper to add

```ts
/**
 * Run a git mutation and rethrow git's own stderr/stdout (via gitErrorOutput) so the
 * UI can surface the message (e.g. a dirty-tree checkout refusal). Read-only helpers
 * call runGit directly; the mutating ones go through this so error surfacing is uniform.
 */
async function runGitChecked(repoPath: string, args: string[]): Promise<string> {
  try {
    return await runGit(repoPath, args)
  } catch (error) {
    throw new Error(gitErrorOutput(error))
  }
}
```
Then each mutation becomes a one-liner, e.g.:
```ts
export async function gitStageFile(repoPath: string, path: string): Promise<void> {
  await runGitChecked(repoPath, ['add', '--', path])
}
export async function gitCheckout(repoPath: string, branch: string): Promise<void> {
  await runGitChecked(repoPath, ['checkout', branch])
}
```
Keep each helper's exported name, signature, JSDoc, and **exact git args** unchanged.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Tests     | `pnpm test -- git` | the plan-009 mutation suite still passes |
| Typecheck | `pnpm typecheck`   | exit 0 |
| Lint      | `pnpm lint`        | exit 0 |
| Full gate | `pnpm verify`      | all four pass |

## Scope

**In scope**:
- `src/main/git.ts` (add `runGitChecked`; convert the mutating helpers to use it)

**Out of scope** (do NOT touch):
- The **read-only** helpers that call `runGit` directly without a try/catch
  (`gitStatus`, `gitNumstat`, diff/log/grep readers) — they don't surface errors this
  way; leave them on `runGit`.
- `gitDiffFile`, `gitSuggestions`, and any helper that does additional work inside the
  catch or doesn't rethrow `gitErrorOutput` — only convert the ones whose body is
  exactly the duplicated try/catch around a single `runGit` call.
- The git args of any command — keep them byte-identical.
- `runGit`/`gitErrorOutput` internals.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `refactor(git): extract runGitChecked for the mutation helpers`.
- Do NOT push unless instructed.

## Steps

### Step 1: Confirm plan 009 has landed

The mutation characterization tests (`describe('mutations')` in `git.test.ts`) must
exist and pass on the current tree. If they don't, STOP — execute plan 009 first.

**Verify**: `pnpm test -- git` → the mutation suite is present and green.

### Step 2: Add `runGitChecked`

Add it near `runGit`/`gitErrorOutput`.

### Step 3: Convert each duplicated helper

For each helper whose body is exactly `try { await runGit(repoPath, ARGS) } catch
{ throw new Error(gitErrorOutput(error)) }`, replace the body with
`await runGitChecked(repoPath, ARGS)`. Do them one at a time and keep the args
identical. Leave the JSDoc.

### Step 4: Verify no behavior change

**Verify**: `pnpm test -- git` → the plan-009 mutation suite passes unchanged (same
stage/unstage/restore/reset/commit behavior and the same throw-on-nothing-staged).
**Verify**: `grep -n "throw new Error(gitErrorOutput(error))" src/main/git.ts` →
only the single occurrence inside `runGitChecked` remains.

### Step 5: Full gate

**Verify**: `pnpm verify` → all four pass.

## Test plan

- No new tests — plan 009's mutation suite is the guard. The refactor is correct iff
  that suite passes identically before and after.
- Verification: `pnpm test -- git` + `pnpm verify`.

## Done criteria

ALL must hold:

- [ ] `runGitChecked` exists; the mutating helpers use it
- [ ] Exactly one `throw new Error(gitErrorOutput(error))` remains (inside `runGitChecked`)
- [ ] Every converted helper keeps its name, signature, and git args
- [ ] The plan-009 mutation suite passes unchanged
- [ ] `pnpm verify` passes
- [ ] Only `src/main/git.ts` is modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Plan 009's mutation tests are not present/green — execute 009 first.
- A helper you were about to convert does something extra in its catch (logs,
  swallows, returns a fallback) — leave it as-is and note it; only the pure
  duplicated wrapper is in scope.
- Any git args would change during conversion — they must not; stop and recheck.

## Maintenance notes

- New mutating git helpers should use `runGitChecked` from the start so error
  surfacing stays uniform.
- This pairs with plan 009: the characterization suite is what makes this refactor
  safe; keep them together in review.
