# Plan 036: Branch-create in the branch picker + a read-only PR-review design spike

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- src/backend/git.ts src/backend/api.ts src/renderer/src/hooks/use-worktrees.ts src/renderer/src/components/shell/branch-switcher.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S (Part A) + spike-only (Part B — produces a document, no code)
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

**Part A — branch-create.** The branch picker can switch (`gitCheckout`) but
not create — CRUD-minus-one on the surface a reviewer touches constantly when
agent work lands branch-per-task. Creating a branch currently means the
terminal, for a one-flag git verb the app already wraps.

**Part B — PR review (spike, not build).** "PR review" is a previously-held
option (it appears in the cleared plans index at commit `876a727` as a held
candidate). The flow-ordered diff is Porcelain's differentiator, and PRs are
where agent output lands for many workflows — but a PR surface drags in
GitHub auth/`gh`, scope-creep toward a GitHub client, and conflicts with the
lightweight principle. That tension is why it stayed held. The deliverable here
is a **decision document**, not code: what the minimal read-only version would
be, exactly what it reuses, and the honest cost list — so the maintainer can
decide with facts.

## Current state

The switch-only checkout, [src/backend/git.ts](../src/backend/git.ts) `:271-278`:

```ts
/** Check out a branch in the current worktree. A name that exists only on a remote
 *  lets git DWIM a local tracking branch off it. Throws git's output (e.g. the
 *  "local changes would be overwritten" refusal on a dirty tree) so the UI can show
 *  it — git itself is the guard against clobbering uncommitted work. */
export async function gitCheckout(repoPath: string, branch: string): Promise<void> {
  await runGitChecked(repoPath, ['checkout', branch])
}
```

`runGitChecked` (same file, just below) rethrows git's own stderr/stdout so the
UI can surface the message — the error-shape convention Part A must follow.

The renderer hook, `src/renderer/src/hooks/use-worktrees.ts:38` —
`useCheckout(): (branch: string) => Promise<void>` (read the file for its
invalidation shape; checkout uses a broad invalidate since a branch switch
changes everything — branch-create-and-switch has the same blast radius, so
copy it).

The picker UI: `src/renderer/src/components/shell/branch-switcher.tsx` (the
sidebar-footer branch chip → menu; errors surface via `sonner` — the one toast
system). Read it before Step A3 and match its idiom.

Range-flow machinery Part B would reuse, `src/backend/api.ts:653-676` —
`gitRangeFlow` already renders "changes since the merge-base with the default
branch" as flow groups; `gitCommitFlow` (`api.ts:~1030`) does it for a single
commit. A fetched PR head is just another ref to feed the same shape.

Conventions that bind Part A: procedures take `repoPath` (stateless router);
zod inputs; pure logic in `git.ts` with a test; hooks own invalidation;
shadcn primitives only (Dialog/Input/Button all exist under
`src/renderer/src/components/ui/`); mutations = whitelisted git verbs, never
pass-through (`QUICK_COMMANDS` at `git.ts:371` is the whitelist pattern —
but a parameterized checkout/create is a dedicated procedure like
`gitCheckout`, not a quick command).

Git-fixture test pattern: `src/backend/git.test.ts` builds real temp repos for
the mutation helpers (a prior plan characterized them) — extend it, following
the existing checkout/staging test shapes.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Targeted  | `pnpm test -- git`          | all pass            |
| Full gate | `pnpm verify`               | exit 0              |

## Scope

**Part A in scope**:
- `src/backend/git.ts` (+ `git.test.ts`)
- `src/backend/api.ts` (one procedure)
- `src/renderer/src/hooks/use-worktrees.ts`
- `src/renderer/src/components/shell/branch-switcher.tsx`

**Part B in scope**:
- `plans/spike-pr-review.md` (create — the only Part B artifact)

**Out of scope**:
- Branch delete/rename (different risk class — delete needs its own
  confirm-and-guard design; not this plan).
- ANY PR-review implementation code, `gh`/octokit dependency, auth storage.
- Worktree creation (the worktree switcher is a separate surface).

## Git workflow

- Commit straight to `main` (hook-enforced verify; branches hook-blocked —
  yes, ironically, while shipping branch-create; the guard blocks YOUR `git
  branch`, the app's runtime `checkout -b` is unaffected). Do NOT push.
- Two commits: `feat: create a branch from the branch picker (checkout -b)` and
  `docs: PR-review spike — minimal read-only design + costs`.

## Steps — Part A

### Step A1: The git helper

In `git.ts`, next to `gitCheckout`:

```ts
/** Create a branch off the current HEAD and switch to it. Throws git's own
 *  message (e.g. "a branch named 'x' already exists") for the UI to surface. */
export async function gitCreateBranch(repoPath: string, branch: string): Promise<void> {
  await runGitChecked(repoPath, ['checkout', '-b', branch])
}
```

Extend `git.test.ts` (follow the existing fixture-repo mutation tests):
creates + switches (current branch reported by `git rev-parse
--abbrev-ref HEAD` is the new name); duplicate name → throws with git's
message; a name like `-foo` → git itself rejects it (`checkout -b` treats it
as an invalid ref name, not an option — assert the throw; this pins the
no-option-injection property).

**Verify**: `pnpm test -- git` → new cases pass.

### Step A2: Procedure + hook

- `api.ts`: `gitCreateBranch: t.procedure.input(z.object({ repoPath: z.string(), branch: z.string().min(1) })).mutation(...)` — placed beside the other git mutations.
- `use-worktrees.ts`: `useCreateBranch(): (branch: string) => Promise<void>`,
  copying `useCheckout`'s invalidation exactly (same blast radius).

**Verify**: `pnpm typecheck` → exit 0.

### Step A3: Picker UI

In `branch-switcher.tsx`: a "New branch…" item at the bottom of the menu
(separator above it, `Plus` lucide icon, matching the menu's item idiom),
opening a small `Dialog` (shadcn) with one `Input` (branch name) + a
create `Button`. Submit → `useCreateBranch`; on error, `sonner` toast with the
thrown message (same as checkout's error path); on success the dialog closes
(the invalidations repaint the chip). Disable create on empty/whitespace input.
No client-side name validation beyond that — git is the validator (the
established checkout philosophy).

**Verify**: `pnpm verify` → exit 0. Manual: `pnpm dev`, playground repo,
create `test-branch` from the picker → chip shows it; creating it again →
toast with git's "already exists".

## Steps — Part B (spike document only)

### Step B1: Write `plans/spike-pr-review.md`

Investigate (read-only) and write up, with these REQUIRED sections:

1. **Minimal shape**: fetch a PR head without any API dependency —
   `git fetch origin pull/<N>/head` (GitHub's ref convention) into
   `FETCH_HEAD`/a temp ref, then feed the existing range-flow path
   (`gitRangeFlow`-style: merge-base with the PR's target, changed files,
   numstat) — cite the exact `api.ts`/`git.ts` functions that would be reused
   vs. the ~2 new helpers needed (fetch-pr-ref, range-against-arbitrary-ref).
   Confirm `gitRangeDiffFile` (`api.ts:677`) covers the per-file diff view for
   an arbitrary base.
2. **What it deliberately is NOT**: no PR list/inbox (entry = paste a PR
   number/URL), no comments-to-GitHub, no approve/merge, no auth (public repos
   + whatever the user's git remote auth already grants — `git fetch` uses it).
3. **Costs, honestly**: where the PR *metadata* (title, target branch) comes
   from without an API client — options: none (user pastes; target = default
   branch assumption) vs `gh` CLI if present (optional enrichment, feature-
   detected, never required). The reviewed-marks/comments channels are keyed
   by repo path and work unchanged; note that review comments on PR files
   reference paths that exist locally after fetch.
4. **UI surface**: an entry point (command in the quick-commands grid? an
   input in the History tab?) — present 2 options with a recommendation,
   grounded in the nomenclature (this is a new *range* source, not a new tab
   kind — the flow views already render ranges).
5. **Open questions for the maintainer** (≤5, each with your recommended
   answer): e.g. is non-GitHub (GitLab MR refs `merge-requests/<N>/head`)
   in-scope day one? Should the fetched ref be cleaned up?
6. **Go/no-go recommendation** with effort estimate (expect: M for the
   minimal shape given the reuse; say what you actually conclude from reading).

No code changes. Everything cited must be a real symbol you opened.

**Verify**: the document exists, every file:line citation resolves
(spot-check three), and it contains the six sections.

## Test plan

Part A: the three `git.test.ts` cases (Step A1). UI has no component test —
the picker's existing coverage level applies (check for
`branch-switcher.test.tsx`; if the repo tests sibling components at this layer,
add a hook-mocked test for the dialog submit; otherwise manual verification
stands, note it).

## Done criteria

- [ ] `pnpm verify` exits 0
- [ ] `pnpm test -- git` includes a passing `gitCreateBranch` duplicate-name case
- [ ] The picker shows "New branch…" and the manual create/duplicate flows
      behaved as described (status note)
- [ ] `plans/spike-pr-review.md` exists with the six required sections and a
      go/no-go recommendation
- [ ] No PR-review implementation code anywhere (`git diff --stat` shows only
      Part A files + the spike doc)
- [ ] `plans/README.md` status rows updated (Part A and the spike tracked separately)

## STOP conditions

- `git.test.ts` has no fixture-repo mutation pattern to extend (it should —
  a prior plan added it; if it's absent, the test harness assumption is wrong; report).
- The branch-switcher menu can't host a dialog without the controlled-menu
  dance described in the architecture skill (the project-switcher precedent:
  controlled `DropdownMenu` + `stopPropagation`) — follow that precedent; if it
  still fights, report.
- During the spike you're tempted to prototype code — don't; the deliverable is
  the document.

## Maintenance notes

- Branch-create deliberately reuses git's own validation and error surface —
  a reviewer should reject any client-side branch-name regex that creeps in.
- If the spike's go recommendation is accepted, the follow-up plan should start
  from the spike doc's "minimal shape" section and the reuse citations, not
  from scratch.
- Branch DELETE remains unplanned by choice (destructive; needs its own
  confirm/guard design) — recorded in the index.
