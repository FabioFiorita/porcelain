# Spike: read-only PR review — minimal shape, reuse, and honest costs

> **Status: SPIKE — decision document, no code.** Produced under plan 036,
> Part B. Everything cited below is a real symbol opened while writing this.
> The go/no-go and effort estimate are at the bottom.

## Context

"PR review" has been a held candidate since the cleared plans index at
`876a727`. The tension that kept it held: Porcelain's differentiator is the
**flow-ordered diff** (review as a story, entry-point → data), and a PR is
exactly where agent output lands for many workflows — but a PR *surface*
threatens to drag in GitHub auth, the `gh`/octokit dependency, and scope-creep
toward "a GitHub client," which fights the lightweight principle.

The insight that makes a minimal version cheap: **a PR head is just another
git ref.** Once it's a ref in the local repo, feeding it through the existing
range-flow path is almost entirely reuse. This doc pins exactly how much.

---

## 1. Minimal shape

**Entry:** the user pastes a PR number (or URL we parse a number out of). No
API call to discover it.

**Fetch the head with no API dependency.** GitHub exposes every PR's head
commit under a synthetic ref: `pull/<N>/head`. Plain git fetches it using
whatever remote auth the user's git already has (SSH key, credential helper,
or nothing for a public repo):

```
git fetch origin pull/<N>/head
```

This lands the head commit in `FETCH_HEAD` (and we'd also write it to a stable
local ref, e.g. `refs/porcelain/pr/<N>`, so a later `merge-base`/`diff` has a
name to hold — `FETCH_HEAD` is clobbered by the next fetch).

**Then feed the existing range-flow path.** Porcelain's `gitRangeFlow`
(`src/backend/api.ts:668-689`) already renders "changes since the merge-base
with the default branch" as flow groups. Its machinery, all reusable:

| Reused symbol | Where | What it does |
|---|---|---|
| `gitMergeBase` | `src/backend/git.ts:566` | common ancestor of `base` and a tip |
| `gitRangeChangedFilesFrom` | `src/backend/git.ts:571` | `--name-status -z` over `<mergeBase>..HEAD` |
| `gitRangeNumstatFrom` | `src/backend/git.ts:619` | `--numstat -z` over the same range |
| `readSourcesAndBuildFlow` | `src/backend/api.ts:173` | the flow-grouping core (shared by `gitFlow`/`gitRangeFlow`/`gitCommitFlow`) |
| `gitDefaultBranch` | `src/backend/git.ts:600` | resolves `origin/HEAD` → default branch (the review base) |
| `readLayers` + `DEFAULT_LAYERS` | `api.ts` | the repo's flow-layer rules (unchanged) |
| `gitRangeDiffFile` | `src/backend/api.ts:691-693` → `git.ts:586` | per-file unified diff for an arbitrary `base` |

**The catch — and the ~2 genuinely new helpers.** The range helpers above take
a *resolved mergeBase* on the left but **hardcode `..HEAD` on the right**
(`git.ts:576`, `:592`, `:623`). PR review must diff against the **fetched PR
tip**, not the working-tree HEAD. So the two new helpers are:

1. **`gitFetchPrRef(repoPath, n)`** — runs `git fetch origin pull/<N>/head` and
   writes the result to a stable local ref, returning that ref name. This is a
   dedicated procedure, **not** a `QUICK_COMMANDS` entry: the whitelist
   (`git.ts:397`, `quickCommandArgs` at `:413`) only appends `pullMode` to a
   fixed argv — the existing `fetch` command is bare `['fetch']` (`git.ts:401`)
   and can't carry a `pull/<N>/head` argument. Parameterized ref → dedicated
   procedure, exactly like `gitCheckout`/`gitCreateBranch`.

2. **Range-against-arbitrary-tip variants** — either add a `tip` parameter to
   `gitRangeChangedFilesFrom`/`gitRangeNumstatFrom`/`gitRangeDiffFile`
   (default `'HEAD'`, so existing callers are untouched) so they diff
   `<mergeBase>..<tip>`, or add three thin siblings. Preferred: **thread an
   optional `tip = 'HEAD'` parameter** — one code path, no duplication, the
   argv change is `` `${mergeBase}..${tip}` ``. `gitMergeBase` also needs the
   two-ref form (`merge-base <target> <prTip>` instead of `<base> HEAD`); it
   already takes `base` as an argument, so it needs a second-ref parameter too.

**`gitRangeDiffFile` covers the per-file view for an arbitrary base — confirmed.**
`src/backend/api.ts:691-693` takes `{ repoPath, base, filePath }` and calls
`git.ts:586`, which resolves `merge-base base HEAD` then diffs
`<mergeBase>..HEAD -- filePath`. It already parameterizes `base`; it only
hardcodes the **right** side (`HEAD`). With the `tip` parameter from (2), the
same procedure renders each PR file's diff with **zero new UI** — the diff view
(`diff-view.tsx`) already consumes `DiffFileResult`.

Net: **~2 new backend helpers + a small parameter-threading change** to four
existing range functions. No new flow logic, no new tab kind, no new diff
renderer.

---

## 2. What it deliberately is NOT

- **No PR list / inbox.** Entry is "paste a PR number/URL," full stop. No
  `GET /pulls`, no unread counts, no author avatars. A list is where the
  GitHub-client scope-creep starts.
- **No write-back to GitHub.** No posting comments, no approve, no merge, no
  status checks. Porcelain's review comments (`~/.porcelain/comments.json`)
  and reviewed marks (`~/.porcelain/reviewed.json`) stay local-only, exactly
  as they are for working-tree/commit review today.
- **No auth of our own.** No token storage, no OAuth, no device flow. We ride
  `git fetch`'s existing auth: public repos need nothing; private repos work
  iff the user's git remote already authenticates (which it must, or they
  couldn't clone). If the fetch fails, we surface git's message (the
  established error-surfacing convention, `runGitChecked` / `gitErrorOutput`
  at `git.ts:300-323`) — we don't try to fix auth.

---

## 3. Costs, honestly

**Where PR *metadata* comes from without an API client.** The fetch gives us
the head *commit* but not the PR's title or its declared target branch. Two
honest options:

- **Option A — none (pure git).** User pastes the number; we assume the review
  target is the repo's **default branch** (`gitDefaultBranch`, already the
  `gitRangeFlow` base). Title is unknown — we label the review "PR #<N>" and
  show the head commit's subject. This is 100% of the minimal shape and needs
  no new dependency. **Cost:** if a PR targets a non-default base (stacked PRs,
  release branches), the merge-base is computed against the wrong branch and
  the file set is wrong. For the common case (PR → main) it's correct.

- **Option B — `gh` CLI as *optional* enrichment.** If `gh` is on `PATH` and
  authenticated, `gh pr view <N> --json title,baseRefName` yields the real
  title and target branch. **Feature-detected, never required** — absence
  silently falls back to Option A. **Cost:** an optional external-tool
  dependency and a code path that must degrade cleanly. Keeps us out of
  octokit/token-storage while fixing the wrong-base case for `gh` users.

Recommendation: **ship Option A; add Option B behind feature-detection** as a
fast follow (or day one if it's cheap — it's one `execFile` with a
try/fallback).

**The local channels work unchanged.** Reviewed marks, review comments, flow
layers, and the board are all **keyed by repo path** (the `~/.porcelain/*.json`
stores), not by ref or range. So a PR review reuses them with no schema change.
**One thing to note:** review comments reference file **paths**, and after
`git fetch` those paths are real in the working tree only if they also exist at
HEAD — the diff itself comes from the fetched ref, but a comment the user
leaves points at `path:line`, which resolves against whatever's checked out.
For a read-only review this is fine (comments are advisory notes to the agent,
path-keyed, same as today); it only matters if we ever try to *open* a PR file
that doesn't exist locally — then we'd read it from the ref
(`git show <prTip>:<path>`), a known pattern, not a blocker.

**Cleanup cost.** Each reviewed PR leaves a `refs/porcelain/pr/<N>` ref and its
objects. Cheap, but unbounded over time — see open question 5.

---

## 4. UI surface

This is a **new range source, not a new tab kind.** The flow views already
render ranges (`gitRangeFlow` powers the branch-vs-default "Changes (whole
branch)" scope). PR review is "point the same range renderer at a fetched ref."
So the UI question is only *where the entry point lives*, not *what renders*.

- **Option 1 — a Quick command in the quick-commands grid**
  (`quick-commands-group.tsx`, shown under Changes/History/Feature). A
  "Review a PR…" command opens a small dialog (one input: PR number/URL), then
  the range flow renders in the viewer. **Pro:** quick-commands is already the
  "do a git thing" surface; discoverable; matches the existing idiom exactly.
  **Con:** quick-commands today are fixed git verbs; this one takes input.

- **Option 2 — an input in the History tab.** History is where "look at a
  range/commit" lives conceptually. A small "PR #___" field at the top of the
  History list. **Pro:** conceptually the right neighborhood (ranges/commits).
  **Con:** adds chrome to a list that's currently pure; less discoverable than
  a labeled command.

**Recommendation: Option 1** (quick-commands "Review a PR…"). It's the
established "perform a git action" entry point, the dialog idiom already exists
(this plan's own branch-create dialog is the precedent), and it keeps History
uncluttered. The result renders in the existing flow/diff views — no new tab
kind, per the nomenclature.

---

## 5. Open questions for the maintainer (each with a recommended answer)

1. **Non-GitHub day one?** GitLab exposes MR heads at
   `refs/merge-requests/<N>/head`; Bitbucket differs. **Recommend: GitHub-only
   day one**, but make the ref pattern a single constant so GitLab is a
   one-line addition when asked. Don't build a provider abstraction up front.
2. **Clean up the fetched ref?** **Recommend: yes, lazily** — keep the last N
   PR refs (or prune on repo close). Don't leak `refs/porcelain/pr/*`
   unbounded, but don't fetch-then-delete either (re-review should be instant).
3. **Wrong-base risk (Option A) — acceptable to ship?** **Recommend: yes** —
   ship default-branch-base, document the assumption, and let `gh` enrichment
   (Option B) fix it for the users who have `gh`. Most PRs target the default.
4. **Should a PR review be persistable/reopenable, or transient?** **Recommend:
   transient day one** — paste-and-review, no saved "PR review" state. The
   local comments/marks persist by repo path regardless. Add persistence only
   if usage shows people re-open the same PR repeatedly.
5. **Private-repo fetch failures — how loud?** **Recommend: surface git's raw
   message as a toast** (the existing convention) and stop. Do not attempt to
   detect/repair auth — that's the GitHub-client rabbit hole we're avoiding.

---

## 6. Go / no-go recommendation

**GO — as the minimal Option-A shape, effort M.**

What reading the code actually shows: the expensive parts (flow grouping, the
diff renderer, the per-file diff over an arbitrary base, the layer rules, the
local review channels) **already exist and already parameterize the base ref.**
The only true new work is (a) one fetch helper for `pull/<N>/head` → a stable
ref, (b) threading an optional `tip` parameter through four range functions
that currently hardcode `..HEAD`, (c) a paste-a-number dialog wired to a
quick-command, and (d) the two-ref form of `gitMergeBase`. That is squarely
**M**, not L — the reuse is real and load-bearing, not aspirational.

The reason it stayed held (scope-creep toward a GitHub client) is **avoidable
by construction** if we hold the "NOT" list in section 2: no inbox, no
write-back, no auth of our own. Every one of those is where the weight lives,
and the minimal shape needs none of them.

**Recommended follow-up plan scope:** start from section 1's reuse table and
the two new helpers; ship Option A; add Option B (`gh` enrichment,
feature-detected) as a fast follow; GitHub-only, transient, lazy ref cleanup.
Do **not** start from scratch — the flow/diff/channel layers are done.
