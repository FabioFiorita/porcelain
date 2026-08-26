---
name: merge-queue
version: 0.59.2
metadata:
  internal: true
description: Land human-selected worktree PRs, update main, and retire their managed checkouts. Load only when the human asks to merge or clean up PR work.
---

# Merge queue

Read `docs/development.md` for the shared worktree loop. This skill covers only the destructive PR
landing sequence.

## Gate

Merge only PRs the human explicitly selects in this session. Resolve the PR number, branch, managed
worktree, mergeability, and required GitHub checks before changing anything. Stop for a substantive
conflict, a failed required check, or ambiguity about the selected work.

## Land each PR

Process selected PRs sequentially because each merge changes `main`:

1. Fetch `origin/main`. If needed, merge it into the PR branch in its worktree and resolve only
   straightforward conflicts.
2. Review the diff against `main` yourself. Fix correctness problems in the same worktree.
3. Run validation proportional to the change. Push branch updates with
   `git -C <worktree> push -u origin work/<slug>`.
4. Squash-merge with `gh pr merge <number> --squash`. Leave branch deletion for cleanup.
5. Fast-forward the primary checkout with `git pull --ff-only origin main`.
6. Run `pnpm worktree remove <slug>`, then delete `origin/work/<slug>`. Never force removal unless
   the human explicitly abandons remaining work.

Finish with `pnpm worktree cleanup`. Report each merged PR and anything left intact, with the reason.
