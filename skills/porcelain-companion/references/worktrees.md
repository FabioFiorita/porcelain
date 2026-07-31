# Worktrees and Porcelain

Every AI harness makes worktrees now, and each one hands you a **fresh absolute repo path**. Porcelain keys per-repo companion data by that absolute path, so a brand-new worktree opens **empty** — no actions, no board, no layers, no hide/pin. That is correct behaviour (a worktree is a different checkout), not a bug to route around.

The app seeds a worktree from its primary checkout when you open one, and the daemon exposes copy/export/import of repo settings. This reference is for when neither is available to you: the worktree lives on a **remote** host, or the human wants a **deliberate subset** carried over. Then you seed it yourself with the CLI, exactly like [sync-environments.md](sync-environments.md) — same rules, shorter hop (usually one host, two paths).

## Seed a fresh worktree

Both checkouts are normally on the **same daemon host**, so you can read from one and write to the other in one session.

```bash
# 1. Both absolute paths
PRIMARY=/home/you/code/my-app
WORKTREE=/home/you/code/my-app-worktrees/fix-auth

# 2. Read what the primary has
~/.porcelain/porcelain actions list --repo "$PRIMARY"
~/.porcelain/porcelain layers get  --repo "$PRIMARY"
~/.porcelain/porcelain scope list  --repo "$PRIMARY"

# 3. Recreate the useful parts against the worktree
~/.porcelain/porcelain actions create --title "Verify" --command "pnpm verify" --repo "$WORKTREE"
~/.porcelain/porcelain scope hide --path apps/legacy --repo "$WORKTREE"   # repo-relative
```

| Carry over | Why | Watch out |
|---|---|---|
| **Saved actions** | The one-click commands are the same project | Rewrite anything with a hardcoded primary path or a fixed port — worktrees usually get their own |
| **Flow layers** | Regex over repo-relative paths; identical repo, identical grouping | Copy verbatim; patterns rarely contain absolute paths |
| **Hidden / pinned scope** | Monorepo noise is the same in every checkout | Stored as **absolute** paths — remap the prefix, or just re-issue `scope hide/pin` with repo-relative paths |
| **Board** | Only if the worktree is where that queue now lives | Usually leave the queue on the primary; a worktree is one unit of work |

**Do not copy:**

- **Review sets** — the Review is the story of *this* unit of work. A worktree exists because it is a different unit. Start it fresh with `review set` (Intent-first).
- **Loop evidence** — proof belongs to the run that produced it. Copied evidence is fabricated evidence.
- **Reviewed marks** — the human reviewed the other checkout, not this one.
- **Notes** — the human's scratchpad; ask before duplicating it.

### The realpath trap

Channel keys are **exact strings**, not resolved paths. A worktree reached through a symlink (`/home/you/code` vs `/data/code`, or macOS `/tmp` → `/private/tmp`) produces two different keys for one directory, and your seeded actions land under the one the app never reads. Before writing anything, pin the key the way the CLI does:

```bash
cd "$WORKTREE" && git rev-parse --show-toplevel   # ← the key the CLI will use
```

Pass that exact value to `--repo`, and if `pwd -P` disagrees with it, seed **both** spellings or fix the path you hand the app. Same rule as remote sync: never assume the string you typed is the string stored.

## Reviewing worktree work

A worktree exists so a unit of work can be reviewed on its own. Keep the whole loop inside it:

1. **Publish the Review in the worktree checkout** — run `review set` / `evidence prepare` with the session cwd inside the worktree (or `--repo "$WORKTREE"`). A Review filed under the primary path is invisible from the worktree window, and vice versa.
2. **Push the branch and open a PR** into the integration branch. Put the Review in the PR body: Intent (thesis), Execution (what changed and why), Evidence (the checks that actually ran, with their real output). The PR body is the version of the Review that survives the worktree being deleted.
3. **Approve from wherever you are** — GitHub on a phone for a small change, or Porcelain when the human wants the diff as a story rather than a file list.
4. **Merge, then delete the worktree.** Anything left only in the worktree's channel data dies with it — which is why step 2 exists.

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
- **Worktrees accumulate anyway.** Detached harness checkouts stay registered in `git worktree list` long after the work merged. Cleaning them is a repo chore, not a Porcelain one — but a stale worktree is also stale Porcelain data keyed to a directory that no longer exists.
