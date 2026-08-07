---
name: merge-queue
version: 0.50.0
metadata:
  internal: true
description: Land selected work/* PRs — human picks, agent rebases, verifies, squash-merges, and retires each worktree (local branch, remote branch, daemon, channels, playground). Load when the human asks to merge worktree PRs, process the queue, or clean up after merges.
---

# Merge queue

Worktree PRs pile up faster than the human can babysit each one. This skill lands the ones they
picked and leaves nothing behind — no stale worktree, no orphaned branch, no dead daemon.

## The one gate

**The human selects which PRs merge.** By number, by slug, or "everything green" — but always an
explicit selection in this session. Never infer selection from a PR looking ready, and never merge
work the human has not signed off on. Everything after selection runs without asking.

## Queue view

```bash
pnpm worktree list
gh pr list --base main --state open --json number,title,headRefName,mergeable,reviewDecision
```

Present the two together: slug, port, PR number/title, mergeable state. PRs from `work/*` branches
map to managed worktrees by slug (`work/<slug>`).

## Per selected PR, in order

1. **Sync with main.** `git fetch origin main`. If the branch is behind, merge main *into* the
   branch inside its worktree (`git -C <worktree> merge origin/main`) — never rebase + force-push;
   the squash-merge erases branch history anyway and `--force-with-lease` is outside the
   allowlisted push shape. Resolve conflicts by intent of both sides; when a conflict is
   substantive (not imports/formatting), stop and show the human before resolving.
2. **Check review feedback.** `gh pr view <number> --json comments,reviews` for issue-level
   comments and review verdicts, plus `gh api repos/{owner}/{repo}/pulls/<number>/comments` for
   inline diff comments. Read every thread — human or bot — and judge whether it flags something
   real. Fix substantive issues in the worktree now, so the fix rides the same verify/push as the
   sync. Nits, already-addressed threads, and stylistic disagreements don't block. If a comment's
   intent is unclear or the fix isn't obvious, stop and ask the human — don't guess.
3. **Verify in the worktree.** After any sync, review-driven fix, or conflict resolution:
   `pnpm verify` (or the scoped test run when the merge only touched lockfile/formatting), per the
   `ship` gate. Push the merge commit with the allowlisted shape:
   `git -C <worktree> push -u origin work/<slug>`.
4. **Merge.** `gh pr merge <number> --squash` — squash keeps main linear; squash subject stays
   under the 1024-char commit cap. Skip `--delete-branch`: the local branch is still checked out
   in the worktree at this point, so git refuses the local delete every time (branch-in-use-by-
   worktree is a git-level lock, not something the flag or cwd can route around) — and when that
   local delete fails, gh skips the remote delete too, leaving the branch orphaned on GitHub.
   Steps 6–7 below delete both explicitly, after the worktree is gone.
5. **Update local main.** From the primary checkout: `git pull --ff-only origin main`.
6. **Retire the worktree.** `pnpm worktree remove <slug>` — stops its recorded dev daemon and
   deletes the checkout, local branch, channels, user data, and playground. If it refuses
   (dirty tree, unmerged), report why instead of forcing; `--force` is only for work the human
   explicitly abandons.
7. **Delete the remote branch.** `git push origin --delete work/<slug>` — the local branch is
   already gone via step 6; this closes out the remote side that `gh pr merge` couldn't.
8. **Board.** Move the card that spawned this unit to done (`porcelain board move`).

Process PRs sequentially — each merge changes main, and the next branch syncs against the result.

## Wrap up

- `pnpm worktree cleanup` — sweeps any remaining merged managed worktrees and prunable harness
  checkouts.
- Report per PR: merged (squash SHA) / skipped (why). A skipped PR stays fully intact.
- Evidence links in PR bodies are ~2-hour presigned R2 URLs; if the human needs one after expiry,
  re-sign from the durable copy: `rclone link r2:beelink/porcelain/pr-evidence/<slug>/<file> --expire 2h`.

## Never

- Merge a PR the human did not select this session.
- Force-push, or push anything other than `work/*` branches.
- Resolve a substantive conflict silently.
- Delete a worktree that holds commits main does not have.
