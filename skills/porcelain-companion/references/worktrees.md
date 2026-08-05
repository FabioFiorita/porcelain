# Worktrees and Porcelain

Every AI harness makes worktrees now, and each one hands you a fresh checkout. Companion data lives **inside the repo** (`<repo>/.porcelain/`), so what a new worktree starts with follows directly from git:

| Channel | Default | A fresh worktree gets… |
|---|---|---|
| Saved actions, scope, flow layers | Shared | **Them, automatically** — git carries the files with the checkout |
| Board, repo notes | Local | Nothing. They are ignored, so they never travel |
| Active review (`active-review/`) | Always ignored | Nothing, **by design** — two worktrees must never fight over one review |
| Archived reviews (`reviews/<id>/`) | Local unless published | Only the ones someone published |

So there is usually **nothing to seed**. If actions or layers are missing in a worktree, the cause is almost always that the channel is set to Local for this repo, not that the worktree needs priming — check Settings › Companion or read `.porcelain/.gitignore`.

**Git visibility is one decision per clone.** `info/` resolves through `$GIT_COMMON_DIR`, so the `.porcelain/` exclude line covers every worktree of a clone, including ones created later. You cannot hide in one worktree and share in another. Full detail: [git-visibility.md](git-visibility.md).

## Targeting the right checkout

Run the CLI **from inside the worktree** and it targets that checkout — it resolves the git toplevel of the cwd. Use `--repo <absolute path>` only to reach a different one.

```bash
cd "$WORKTREE" && ~/.porcelain/porcelain review get     # this checkout
~/.porcelain/porcelain --repo "$PRIMARY" board list     # a different one
```

### Where paths still matter

Companion channels are no longer keyed by absolute path, so the old symlink trap is gone for them. Two things are still path-keyed in `~/.porcelain`, and both **fail closed**, which is the safe direction:

- **Command trust** (`action-trust.json`) — a worktree is a different path, so a shared action the human already accepted in the primary checkout asks again there. Expected; do not try to pre-seed trust.
- **Recent repos / last-opened** — cosmetic only.

If you need the exact string the CLI will use:

```bash
cd "$WORKTREE" && git rev-parse --show-toplevel
```

## Reviewing worktree work

A worktree exists so a unit of work can be reviewed on its own. Keep the whole loop inside it:

1. **Publish the Review in the worktree checkout** — run `review set` / `evidence prepare` with the session cwd inside the worktree (or `--repo "$WORKTREE"`). `active-review/` is per checkout, so a Review written in the primary is not the one the worktree window shows.
2. **Push the branch and open a PR** into the integration branch. Put the Review in the PR body: Intent (thesis), Execution (what changed and why), Evidence (the checks that actually ran, with their real output). The PR body is the version of the Review that survives the worktree being deleted.
3. **Approve from wherever you are** — GitHub on a phone for a small change, or Porcelain when the human wants the diff as a story rather than a file list.
4. **Merge, then delete the worktree.** The active review is gitignored, so it dies with the directory unless the human **publishes** it (which archives it to `reviews/<id>/` and re-includes that folder so it can be committed). That, or the PR body, is what survives — which is why step 2 exists.

## Harness worktrees

Each harness puts worktrees somewhere different and configures them from different files in the repo. Know which one you are in before you resolve a path.

| Harness | Location | Branch or detached | Configured by |
|---|---|---|---|
| **Claude Code** | `.claude/worktrees/<name>` by default, or wherever a `WorktreeCreate` hook prints | Branch — `worktree-<name>` by default | `WorktreeCreate` / `WorktreeRemove` hooks in `.claude/settings.json`; when set they **replace** the built-in logic and `.worktreeinclude` is not processed. `worktree.baseRef` picks a fresh base ref (default) or the current `head` |
| **Codex** (ChatGPT app) | `~/.codex/worktrees/` | **Detached HEAD** — cannot be forced onto a branch | Setup scripts in the repo's `.codex` folder (written by the app's settings pane); `.worktreeinclude` at the repo root copies **gitignored** files in |
| **Grok Build** | `~/.grok/worktrees/<repo>/<name>` | **Detached HEAD** | No setup hook; `--ref main` for a clean base, `grok worktree gc --max-age 7d` to clean up |
| **T3 Code** | `~/.t3/worktrees/<repo>/<branch>` | **Always a branch** (temp `t3code/<hex>`, renamed later) | `t3.json` at the repo root — the script with `runOnWorktreeCreate: true` runs in a visible terminal with `T3CODE_PROJECT_ROOT` and `T3CODE_WORKTREE_PATH` set |

Practical consequences:

- **Detached HEAD is not a branch.** In Codex and Grok worktrees, commit, then create/push a branch before opening a PR. Never report "pushed" without checking `git rev-parse --abbrev-ref HEAD`.
- **Gitignored setup does not travel by itself.** Personal config (agent instruction overrides, local settings) reaches a worktree only through the mechanism that harness supports: `.worktreeinclude` (Codex), a setup script (T3 Code), a create hook (Claude Code), or your own `ln -s` (Grok Build).
- **Codex's `.codex` folder is written by the app.** If the repo has no setup script, tell the human to configure it once in the ChatGPT app's local-environment settings pane and commit the generated folder — do not hand-author a schema you cannot verify.
- **Some worktrees vanish on their own.** Claude Code auto-removes unnamed clean worktrees at session exit, and sweeps subagent worktrees after `cleanupPeriodDays` unless they still hold work (`-p` runs never clean up). Anything you want the human to keep — a published Review's evidence, a branch — must leave the worktree before the session ends.
- **Worktrees accumulate anyway.** Detached harness checkouts stay registered in `git worktree list` long after the work merged. Cleaning them is a repo chore, not a Porcelain one — and since companion data now lives in the checkout, deleting the worktree takes its unpublished review with it.
