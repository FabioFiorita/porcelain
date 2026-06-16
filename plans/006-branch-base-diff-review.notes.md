# Design memo — Review a branch against its base (cumulative diff)

> Companion to **plan 006**. The inert data-layer prototype landed on branch
> `improve/execute-all` as commit `4b67dea`
> (`feat(git): prototype branch-range diff helpers`). This memo records what it
> proved and the one product decision it tees up — **the surface** — for the
> maintainer to pick before a build plan is written.

## 1. What the prototype proved

The range data path is **three small helpers, ~25 lines**, each going through the
existing `runGit` wrapper and reusing the existing `diff.ts` parsers — no new git
machinery, no new parser:

- `gitMergeBase(repoPath, base)` → the common ancestor SHA (`merge-base <base> HEAD`).
- `gitRangeChangedFiles(repoPath, base)` → `ChangedFile[]` via
  `diff --name-status -z <mergeBase>..HEAD` through `parseNameStatus`.
- `gitRangeDiffFile(repoPath, base, filePath)` → `DiffHunk[]` via
  `diff <mergeBase>..HEAD --no-color -- <file>` through `parseUnifiedDiff`.

A temp-repo unit test (in `src/main/git.test.ts`) builds a real `main`→`feature`
branch and confirms the range yields **only the branch's changes** (`base.ts`
modified + `feature.ts` added — *not* the base commit's own files), with hunk
content matching the edit. Full gate green (228 tests).

The decisive finding: **the rendering already exists.** `gitRangeChangedFiles`
returns the exact `ChangedFile[]` shape that `buildFlow` (`src/main/flow.ts`)
already groups into flow-ordered layers, that `HunksView` already renders, and
that `feature-view.ts` already widens. A branch-review surface is therefore mostly
*wiring*, not new capability — the heart of why this finding is high-leverage.

## 2. Range definition — the question that shapes everything

**Committed-only vs. including uncommitted work.** The prototype implements
committed-only (`mergeBase..HEAD`). Recommendation: **keep committed-only.** It
matches the mental model "review what the branch *added*," and it keeps a clean
seam from the existing Changes tab, which already owns the working tree. Including
uncommitted work would make the range and the Changes tab overlap (the same edits
appear in both, with different freshness models) — confusing, and it muddies "this
is the branch as it will merge." If a "branch + my in-flight edits" view is later
wanted, it's an additive variant, not the default.

**Base selection.** Recommendation: **auto-detect the merge-base with the repo's
default branch, with a manual override.** Most reviews are "everything since
`main`"; auto-detect makes the common case zero-click. The override (pick any ref)
covers stacked branches and "since the last release tag." `gitMergeBase` already
takes an arbitrary `base`, so the override is free at the data layer.

## 3. The surface — three options, with a recommendation

Using the `CLAUDE.md` Nomenclature regions:

**(a) A base/scope toggle on the existing Changes tab** — switch the Changes list
between "Working tree" and "Branch since `<base>`". Reuses `changes-list.tsx` and
the flow grouping verbatim; the base picker sits in the Changes header. *Pro:*
lowest new surface, no new tab, ships fastest. *Con:* one tab now carries two
freshness models (live poll vs. static range) — needs a clear mode indicator so
the user always knows which they're looking at.

**(b) A new sidebar tab "Branch" (Cmd+5)** — a peer of Files/Changes/History/
Feature. *Pro:* clean separation, each tab one freshness model. *Con:* adds a fifth
tab to a **deliberately four-tab rail** (a standing product decision); the bar to
add a tab is high.

**(c) Fold it into the Feature tab** — the Feature view already *widens* a change
into the whole feature; a committed branch is just a different **seed** for the
same widening (a range instead of the working-tree change set). *Pro:* arguably the
most on-thesis — it unifies "review the feature" whether the feature is in the
working tree, agent-declared, or committed on a branch. *Con:* reworks the
feature-view input model (today seeded by working-tree changes + the MCP review
set), the highest-risk option.

**Recommendation: ship (a) first, treat (c) as the eventual unification.** (a) is
the smallest correct cut — it reuses `changes-list.tsx` + `gitFlow`'s grouping with
only a base picker and a query swap, respects the four-tab rail, and proves the
range-review interaction with minimal risk. Once it's proven, (c) is the principled
end state: one "review this feature" surface seeded by working-tree / agent set /
branch range alike. (b) is not recommended — it spends the four-tab budget for less
than (c) buys.

## 4. Freshness model

A committed range is **static until the next commit or a branch switch** — unlike
the working tree. So a `gitRangeFlow` query must NOT copy `use-git-flow.ts`'s
`staleTime: 0` + 3 s poll (that exists because the working tree changes under you).
Instead: **cache-until-invalidated**, invalidated on commit, branch switch, or an
explicit refresh. This also means the range view is cheaper than the live Changes
tab — no background polling.

## 5. Build outline (once the surface is picked)

For the recommended path (a):

1. **Procedure** — add `gitRangeFlow(repoPath, base)` to `src/main/api.ts`,
   copying the `gitFlow` procedure shape (`api.ts:~403`): call
   `gitRangeChangedFiles`, read each changed file's source (≤1 MB, reuse the
   existing read+cap), `buildFlow(files, sources, layers)`, merge a range numstat.
   Memoize on a key that includes `base` + `HEAD` SHA (use the `flowKey` helper
   from plan 016).
2. **Hook** — `use-branch-flow.ts` (domain hook, cache-until-invalidated per §4).
3. **UI** — a base picker + mode toggle in the Changes header; `changes-list.tsx`
   renders the range groups unchanged.
4. **Invalidation** — bust on commit / branch switch (the worktree switcher and
   commit composer already emit events to hook into).

If (c) is chosen instead, follow the architecture skill's "new screen/tab kind"
recipe only for the seed change; the reading surface is reused.

No new tab kind, no `tabs.ts` change, is needed for (a).

## 6. Open questions for the maintainer

- **Surface:** (a) Changes-tab toggle [recommended], (b) new Branch tab, or (c)
  fold into Feature?
- **Range definition:** committed-only [recommended] or include uncommitted work?
- **Base picker location & default:** auto merge-base with the default branch +
  override [recommended] — where does the picker live (Changes header? top bar?)?
- **Should the Feature view's seed accept a range** (the (c) unification), now or
  later?
- **Numstat for ranges:** worth showing +/- counts in the range view (a
  `diff --numstat -z <mergeBase>..HEAD` mirror), or defer?

## Note on the prototype commit

The three helpers are **inert** — nothing in the app calls them yet (only the
tests). They're test-covered, so not dead code, but if you'd rather not carry a
speculative prototype on `main` until the surface is decided, commit `4b67dea` is a
clean, isolated drop (`git rebase --onto` or cherry-pick-exclude) — it touches only
`git.ts` + `git.test.ts`.
