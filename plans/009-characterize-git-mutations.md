# Plan 009: Characterization tests for the git mutation helpers

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/main/git.ts src/main/git.test.ts`
> If either changed since this plan was written, compare against "Current state"; on
> a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

`git.ts` is the highest-churn file in the main process, and its **mutating**
helpers — the ones that touch the index and the working tree — have **zero** direct
tests. `git.test.ts` covers only read/parse helpers and a range-diff prototype.
These mutations wrap destructive git verbs (`restore --staged --worktree
--source=HEAD`, `reset`, `add`, `commit`). A wrong flag (e.g. `gitRestoreFromHead`
losing `--worktree`, or `gitResetPath` gaining `--hard`) would **not** fail
typecheck or lint and would ship as **silent data loss** of the user's uncommitted
work. The most dangerous branch is the discard decision in the `gitDiscardFile`
procedure, which trashes a file when `gitFileInHead` returns `false` — if that
predicate ever misreported a tracked file as new, discard would trash a tracked
file's working copy instead of reverting it. Characterization tests pin the
argv-level behavior so a regression is caught by the commit gate.

## Current state

`src/main/git.ts` exports these mutating helpers (each wraps `runGit` and rethrows
git's stderr via `gitErrorOutput`):
- `gitStageAll(repoPath)` → `add -A`
- `gitUnstageAll(repoPath)` → `reset -q`
- `gitStageFile(repoPath, path)` → `add -- <path>`
- `gitUnstageFile(repoPath, path)` → `restore --staged -- <path>`
- `gitFileInHead(repoPath, path)` → `cat-file -e HEAD:<path>` (true/false; false on an unborn branch)
- `gitRestoreFromHead(repoPath, path)` → `restore --staged --worktree --source=HEAD -- <path>`
- `gitResetPath(repoPath, path)` → `reset -q -- <path>` (unstage only; leaves the working file)
- `gitCommit(repoPath, message)` → `commit -m <message>` (staged only — never auto-stages)

`runGit` uses `execFile('git', args)` (arg array, no shell) with `GIT_OPTIONAL_LOCKS=0`.

`src/main/git.test.ts` already has the exact harness you need — a temp-repo helper
and the deterministic git env:
```ts
const GIT_ENV = { GIT_AUTHOR_NAME: 'Test User', GIT_AUTHOR_EMAIL: 'test@porcelain.test',
  GIT_COMMITTER_NAME: 'Test User', GIT_COMMITTER_EMAIL: 'test@porcelain.test',
  GIT_AUTHOR_DATE: '2024-01-01T12:00:00Z', GIT_COMMITTER_DATE: '2024-01-01T12:00:00Z' }
function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, env: { ...process.env, ...GIT_ENV }, stdio: 'pipe' }).toString()
}
```
and a `beforeAll` that `mkdtemp`s a repo, `git init -b main`, commits with
`-c commit.gpgsign=false`. Reuse this setup pattern (a fresh temp repo per `describe`
so mutation tests don't interfere with the range-diff prototype's repo).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Tests     | `pnpm test -- git`       | all pass, new cases included |
| Typecheck | `pnpm typecheck`         | exit 0 |
| Lint      | `pnpm lint`              | exit 0 |
| Full gate | `pnpm verify`            | all four pass |

## Scope

**In scope** (tests only):
- `src/main/git.test.ts` (add a `describe('mutations')` block + its own temp repo)

**Out of scope** (do NOT touch):
- `src/main/git.ts` — these tests pin **current** behavior. If a test reveals a real
  bug (a wrong flag), STOP and report; do not change `git.ts` here.
- `src/main/api.ts` — the `gitDiscardFile`/`gitCommit` *procedures* (which compose
  these helpers + `shell.trashItem`/config writes) are harder to unit-test (Electron
  `shell`, the tRPC router). They are out of scope for THIS plan; this plan covers
  the git-side helpers, which is where the destructive argv lives. (A follow-up could
  test the procedure branch via `appRouter.createCaller` — note it, don't build it.)
- `shell.trashItem` — not reachable from a vitest (no Electron). The git-side guard
  that decides trash-vs-revert is `gitFileInHead`; test **that** thoroughly instead.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `test(git): characterize stage/unstage/restore/reset/commit + gitFileInHead`.
- Do NOT push unless instructed.

## Steps

### Step 1: Add a `describe('mutations')` with its own temp repo

Reuse the `git()` helper and `GIT_ENV`. In a `beforeAll`, create a fresh temp repo
(`mkdtemp`), `git init -b main`, set `commit.gpgsign=false` (use `-c` per command as
the existing tests do), write and commit a `tracked.ts` file so HEAD exists. Reset
the repo to a known state in `beforeEach` if cases mutate it (or create a fresh repo
per `it` for isolation — simplest and least flaky).

### Step 2: Cover `gitFileInHead` (the trash-vs-revert guard)

Assert:
- A committed/tracked file ⇒ `true`.
- A brand-new untracked file ⇒ `false`.
- A new file that has been `git add`-ed but never committed ⇒ `false` (it's not in
  HEAD; only the index).
- (Optional) On a fresh repo with no commit yet (unborn branch), any path ⇒ `false`.

This is the most important case: it's what decides whether discard reverts or
trashes.

### Step 3: Cover stage / unstage

- `gitStageFile`: modify `tracked.ts`, `gitStageFile`, assert `git status --porcelain`
  shows it staged (`M ` in the index column).
- `gitUnstageFile`: from the staged state, `gitUnstageFile`, assert it's unstaged
  (` M`).
- `gitStageAll` / `gitUnstageAll`: stage-all with a modified + a new file, assert
  both staged; unstage-all, assert both unstaged. (`gitStageAll` uses `add -A`, so it
  stages untracked files too — assert that.)

### Step 4: Cover the destructive restore/reset

- `gitRestoreFromHead`: modify `tracked.ts` (both working tree and index by staging),
  call `gitRestoreFromHead`, assert the file content equals the committed version
  **and** `git status --porcelain` is clean for it (both index and worktree restored
  — this verifies `--staged --worktree --source=HEAD` is intact).
- `gitResetPath`: `git add` a **new** file, call `gitResetPath`, assert it is
  **unstaged** (back to untracked) **and still exists on disk** (`reset` must not
  delete the working copy — this is the discard-new-file path before the caller
  trashes it).

### Step 5: Cover `gitCommit` (staged-only, never auto-stages)

- Stage a change, `gitCommit(repo, 'msg')`, assert `git log -1 --pretty=%s` is `msg`
  and the file is committed.
- **Important invariant**: make an *unstaged* change, then `gitCommit` with nothing
  staged — assert it throws (git: "nothing to commit") and does **not** create a
  commit, confirming `gitCommit` never `add -A`s on its own (an `audit` invariant).

**Verify**: `pnpm test -- git` → all pass, new cases included.

### Step 6: Full gate

**Verify**: `pnpm verify` → all four pass.

## Test plan

- `git.test.ts` gains a `describe('mutations')` covering Steps 2–5. Assertions read
  state with the raw `git()` helper (`status --porcelain`, `log -1 --pretty=%s`) and
  `readFileSync` for content — no need to call the read-side helpers.
- Verification: `pnpm test -- git` → all pass.

## Done criteria

ALL must hold:

- [ ] `git.test.ts` covers `gitFileInHead` (tracked/new/staged-new), stage/unstage
      (file + all), `gitRestoreFromHead` (content + clean status), `gitResetPath`
      (unstaged + file still on disk), and `gitCommit` (commits staged; throws with
      nothing staged)
- [ ] `git.ts` is unmodified
- [ ] `pnpm test -- git` passes
- [ ] `pnpm verify` passes
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Any helper behaves destructively beyond its doc (e.g. `gitResetPath` removes the
  working file, or `gitRestoreFromHead` leaves the index dirty) — that's a real bug;
  report it, do not paper over it with a lenient assertion.
- `gitCommit` creates a commit when nothing is staged — that would mean it
  auto-stages, violating an `audit` invariant; report it.
- A helper's exported name/signature differs from "Current state" — use the live one
  and note the drift.

## Maintenance notes

- This unblocks **plan 017 (`runGitChecked`)**, which refactors the try/catch
  wrappers around these same helpers — run this suite before and after that refactor
  to prove the argv behavior is unchanged.
- A reviewer changing any `git.ts` mutation flag should expect one of these tests to
  move; if none does, the change isn't characterized.
- Follow-up (deferred, not this plan): characterize the `gitDiscardFile` and
  `gitCommit` **procedures** in `api.ts` via `appRouter.createCaller`, asserting the
  discard branch and the commit→reviewed-paths reconciliation.
