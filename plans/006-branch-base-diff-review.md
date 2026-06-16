# Plan 006: Design + prototype "review a branch against its base" (cumulative diff)

> **Executor instructions**: This is a **design/spike plan**, not a build-everything
> plan. Your job is to (1) build a small, low-risk, well-tested data-layer prototype
> and (2) write a design memo that recommends the UI surface and lists the open
> product decisions. You will **STOP before building any UI or router wiring** — those
> choices are the maintainer's to make (this repo's hard rule 1: never introduce a new
> UI/router pattern without the maintainer's approval). Run every verification command
> and confirm the expected result before moving on. When done, update the status row
> for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- src/main/git.ts src/main/api.ts src/main/flow.ts`
> If `git.ts`, `api.ts`, or `flow.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M (prototype is S; the design memo is the bulk)
- **Risk**: LOW (the prototype only adds new pure helpers + tests; touches no UI)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

Porcelain's whole thesis is "review changes as a story" via flow-ordering, and the
feature view widens a change into the whole feature. **Both currently anchor only on
the working tree.** But coding agents *commit as they work*, so by the time you sit
down to review, the feature is spread across N commits, the Changes tab is empty, and
your only path is clicking through individual commits in the History tab one at a
time — which fragments the exact story the flow view exists to tell.

The natural review unit is **a branch / a feature / "everything since `main`"** — the
cumulative diff against the merge-base. The rendering for it already exists
(`diff.ts` parses unified diffs, `flow.ts` orders them, `HunksView` renders them,
`feature-view.ts` widens them); what's missing is a git data path that produces a
*range* diff instead of a working-tree diff, and a UI surface to drive it. This plan
proves the data path is cheap and tees up the one product decision (the surface) for
the maintainer.

## Current state

Every diff/changes surface in the app reads **one of two things** — the working tree,
or a single historical commit. There is no merge-base range diff anywhere.

- `src/main/git.ts` — all git shell-outs. The relevant existing functions, which the
  new helpers must mirror in style:
  - `gitStatus(repoPath)` (line ~104) → working-tree changed files.
  - `gitDiffFile(repoPath, filePath)` (line ~248) → one file's working-tree diff:
    ```ts
    export async function gitDiffFile(repoPath: string, filePath: string): Promise<DiffHunk[]> {
      const status = await runGit(repoPath, ['status', '--porcelain=v1', '-uall', '-z', '--', filePath])
      if (parseStatus(status)[0]?.status === 'untracked') {
        return synthesizeAddDiff(await readFile(join(repoPath, filePath), 'utf8'))
      }
      return parseUnifiedDiff(await runGit(repoPath, ['diff', 'HEAD', '--no-color', '--', filePath]))
    }
    ```
  - `gitCommitFiles(repoPath, hash)` / `gitCommitDiff(repoPath, hash, filePath)`
    (lines ~88–104) → a single commit's files and per-file diff. **These are the
    closest existing analogues to what a range needs** — read them in full; a range
    diff is essentially `gitCommitDiff` with a `base...HEAD` revision range instead of
    one hash.
  - `runGit(repoPath, args)` — the shared shell-out wrapper (sets `GIT_OPTIONAL_LOCKS=0`
    for background-poll safety). All new helpers MUST go through it, never `execFile`
    directly.
  - `parseStatus` / `parseUnifiedDiff` / `synthesizeAddDiff` live in `src/main/diff.ts`
    and are already imported by `git.ts`. Reuse them; do not write a new diff parser.
- `src/main/flow.ts` — `buildFlow(files, sources, layers)` groups a `ChangedFile[]`
  into flow-ordered `FlowGroup[]`. It is **input-agnostic**: it takes a list of changed
  files + their source text + the layer config. A range's changed-file list flows
  through it unchanged — this is why the surface is cheap.
- `src/main/api.ts` — the `gitFlow` procedure (lines 387–419) shows the exact
  assemble-and-memoize shape a future range procedure would copy (read `gitStatus`,
  read each file's source ≤1 MB, call `buildFlow`, merge numstat). **Do not add a new
  procedure in this plan** — a tRPC procedure with no UI consumer is dead code, which
  this repo forbids. The procedure is part of the *build* plan that follows the
  maintainer's surface decision.
- `src/main/git.test.ts` — the test exemplar. It unit-tests pure arg-resolution
  (`quickCommandArgs`) without spawning git. Your prototype tests follow the same
  style: test the **pure parsing/assembly** you add, and for anything that needs a real
  git invocation, build a tiny temp-repo fixture (see the e2e fixture builder
  `e2e/helpers/fixture-repo.ts` for how the repo creates deterministic git repos —
  read it for the pattern, but keep your unit fixture minimal and local).

**Repo conventions that apply here** (from the `architecture` skill):
- Pure logic in its own well-tested main-process module; shell-out only through
  `runGit`. No git libraries — parse porcelain output.
- Strict TypeScript: no `any`, no `as unknown as` casts. Explicit return types.
- `git` data is treated as live; `fs` reads are cached — but a *range* is static until
  you commit again, so note that in the memo (it informs the freshness model).
- Conventional Commits for any commit you make (e.g. `feat(git): …`, `docs: …`).

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Install   | `pnpm install`                       | exit 0              |
| Lint      | `pnpm lint`                          | exit 0              |
| Typecheck | `pnpm typecheck`                     | exit 0, no errors   |
| Tests     | `pnpm test`                          | all pass            |
| One file  | `pnpm test -- git`                   | `git.test.ts` passes|
| Build     | `pnpm build`                         | exit 0              |

The full verification gate before any commit (this repo's hard rule 3) is
`pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Scope

**In scope** (the only files you may modify):
- `src/main/git.ts` — add the prototype helpers (Step 1).
- `src/main/git.test.ts` — add their tests (Step 2).
- `plans/006-branch-base-diff-review.notes.md` — **create**; the design memo (Step 3).
- `plans/README.md` — update this plan's status row at the end.

**Out of scope** (do NOT touch — these are the maintainer's decision, deferred to the
build plan that follows this spike):
- Any file under `src/renderer/` — no UI, no new tab kind, no Changes-tab changes.
- `src/main/api.ts` — no new tRPC procedure yet (would be dead code without a consumer).
- `src/renderer/src/stores/tabs.ts` — no new tab kind.
- The existing working-tree `gitFlow` / `gitDiffFile` paths — leave them exactly as is;
  the range path is **additive and parallel**, never a modification of the live path.

## Steps

### Step 1: Prototype the range data-layer helpers in `git.ts`

Add three small functions to `src/main/git.ts`, each going through `runGit` and reusing
the existing `diff.ts` parsers. Match the style of the surrounding functions exactly
(same error handling, same `Promise` return types, JSDoc one-liner above each).

1. `gitMergeBase(repoPath, base)` → `Promise<string>`: returns the merge-base SHA of
   `base` and `HEAD`. Shell: `merge-base <base> HEAD`. Trim the output. This is what
   makes "since I branched from main" correct even when `main` has moved on.
2. `gitRangeChangedFiles(repoPath, base)` → `Promise<ChangedFile[]>`: the files that
   changed between the merge-base and the working tree (or `HEAD` — see the memo's open
   question on whether the range includes uncommitted work). Start with committed-only:
   `diff --name-status <mergeBase>..HEAD`. Parse with the existing name-status parser
   (`parseNameStatus` in `diff.ts`, already used by `gitCommitFiles` — read how
   `gitCommitFiles` calls it and copy that).
3. `gitRangeDiffFile(repoPath, base, filePath)` → `Promise<DiffHunk[]>`: one file's diff
   across the range. Shell: `diff <mergeBase>..HEAD --no-color -- <filePath>`, parsed
   with `parseUnifiedDiff`. (Mirror `gitDiffFile`, minus the untracked branch — a
   committed range has no untracked files.)

Keep them exported (the tests consume them, which is what keeps them from being dead
code in this spike). Do not call them from anywhere else yet.

**Verify**: `pnpm typecheck` → exit 0. `pnpm lint` → exit 0.

### Step 2: Test the helpers against a temporary git repo

In `src/main/git.test.ts`, add a `describe('range diff prototype', …)` block. Create a
minimal temp git repo in the OS temp dir inside the test (init, configure a fixed
author, commit a base file, branch, commit a change), then assert:
- `gitMergeBase` returns the expected base commit SHA (the one you tagged/recorded).
- `gitRangeChangedFiles` lists exactly the files changed on the branch since the base
  (not the base commit's own files).
- `gitRangeDiffFile` returns hunks whose added/removed lines match the branch change.

Follow the determinism techniques in `e2e/helpers/fixture-repo.ts` (fixed
`GIT_AUTHOR_*`/`GIT_COMMITTER_*` env, `git -c` config) so the test is host-independent.
Clean up the temp dir in an `afterAll`/`finally`.

**Verify**: `pnpm test -- git` → the new cases pass alongside the existing
`quickCommandArgs` tests.

### Step 3: Write the design memo — `plans/006-branch-base-diff-review.notes.md`

This is the real deliverable. Write a focused memo (not a novel) that answers each
question below with a recommendation **and** the trade-off, grounded in the code you
just read. The maintainer will read this and pick; a build plan follows.

The memo MUST contain these sections:

1. **What the prototype proved** — one paragraph: the range data path is ~3 small
   helpers reusing the existing parsers and `buildFlow`; cite the test results.
2. **Range definition — the open question that shapes everything**:
   - Committed-only (`mergeBase..HEAD`) vs. including uncommitted work
     (`mergeBase` + working tree). Recommend one. (Committed-only is simpler and matches
     "review what the branch added"; including the working tree means the range and the
     existing Changes tab overlap. State the trade-off.)
   - Base selection: auto merge-base with the repo's default branch vs. a user-picked
     base ref. Recommend auto-detect-with-override.
3. **The surface — three options, with a recommendation**. Describe each concretely in
   terms of *this* app's regions (use the `CLAUDE.md` Nomenclature names):
   - (a) **A base picker on the existing Changes tab** that switches it between
     "working tree" and "branch since `<base>`" — reuses `changes-list.tsx` +
     `gitFlow`'s grouping verbatim, lowest new surface, but overloads one tab with two
     freshness models.
   - (b) **A new sidebar tab** (e.g. "Branch", Cmd+5) peer of Files/Changes/History/
     Feature — clean separation, but adds a fifth tab to a deliberately-four-tab rail.
   - (c) **Fold it into the Feature tab** — the Feature view already widens a change;
     a range is just a different *seed* for the same widening. Possibly the most
     on-thesis, but reworks the feature-view input model.
   - Give your recommendation and why, in 3–5 sentences.
4. **Freshness model** — note that a committed range is static until the next commit,
   so it should NOT use `gitFlow`'s `staleTime: 0` + 3s poll (cite
   `src/renderer/src/hooks/use-git-flow.ts`); a range query is cache-until-invalidated,
   invalidated on commit/branch-switch.
5. **The build outline** — the steps a build plan would take once the surface is picked,
   following the architecture skill's "adding a new screen/tab kind" recipe if a new
   tab is chosen (procedure → hook → tab kind → view → opener → keybinding), or the
   simpler picker-on-Changes path. Reference the `gitFlow` procedure (api.ts:387) as
   the template for the new `gitRangeFlow` procedure.
6. **Open questions for the maintainer** — a short bulleted list of every decision that
   needs a human (range definition, surface, where the base picker lives, whether the
   Feature view's seed should accept a range).

**Verify**: the file exists and every numbered section above is present:
`grep -c '^## ' plans/006-branch-base-diff-review.notes.md` → at least 6.

### Step 4: Run the full gate and update the index

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.
Update this plan's row in `plans/README.md` to DONE (note: "prototype + design memo
landed; surface decision pending maintainer").

## Test plan

- New tests in `src/main/git.test.ts`: a `range diff prototype` describe block covering
  `gitMergeBase` (correct base SHA), `gitRangeChangedFiles` (branch files only, not the
  base commit's), and `gitRangeDiffFile` (hunks match the branch change). Model the
  temp-repo setup on `e2e/helpers/fixture-repo.ts`.
- No renderer tests (no renderer changes in this spike).
- Verification: `pnpm test` → all pass including the new git cases.

## Done criteria

ALL must hold:

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all exit 0.
- [ ] `git.ts` exports `gitMergeBase`, `gitRangeChangedFiles`, `gitRangeDiffFile`, each
      going through `runGit` and reusing `diff.ts` parsers (`grep -n "runGit" src/main/git.ts`
      shows the new calls; no new `execFile` import).
- [ ] New `git.test.ts` cases for all three helpers pass.
- [ ] `plans/006-branch-base-diff-review.notes.md` exists with all six required sections.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] No new tRPC procedure, no renderer changes, no new tab kind.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The `git.ts` excerpts in "Current state" don't match the live code (drift since
  `e1f8d02`).
- You find yourself wanting to add a tRPC procedure or any renderer code to "make it
  visible" — that is explicitly the next (build) plan, gated on the maintainer's surface
  pick. Building UI here violates hard rule 1.
- `parseNameStatus` / `parseUnifiedDiff` / `synthesizeAddDiff` don't exist in `diff.ts`
  with those names — re-read `diff.ts`, find the actual exports, and use them (note the
  rename in your report) rather than writing a new parser.
- A range diff against the merge-base returns surprising results you can't explain
  (e.g. it includes the base commit's files) — report what you observed; the range
  definition is the crux the memo must get right.

## Maintenance notes

- This spike deliberately leaves the product decision (surface + range definition) to
  the maintainer. The prototype helpers are inert until a build plan wires them.
- The build plan should reuse `buildFlow` and the `gitFlow` procedure shape verbatim —
  the value of this finding is precisely that the rendering is already built.
- Watch in review: that the new helpers don't accidentally get called from the live
  working-tree path (they must stay parallel), and that the temp-repo test cleans up.
- Deferred out of scope: GitHub PR review (a separate, larger direction finding — was
  considered and explicitly deferred in this audit; see `plans/README.md`).
