# Config Persistence & Git Plumbing

## Config persistence

- **All config writes go through `createHomeChannel`**: atomic tmp+rename, corrupt files backed up to
  `.corrupt-*`, and `updateConfig(mutate)` serializing read-modify-write. **Never reintroduce a bare
  load→mutate→save pair** — concurrent mutations dropped writes and a crash mid-write corrupted
  `config.json`. Read-only callers may use `loadConfig`.
- **Hidden-path filtering happens in the MAIN process** (`visibleFilePaths`, tested), not the renderer —
  the renderer must never receive paths the user hid.

## Git plumbing

- **The pre-commit process clears Git's hook-local environment.** Git exports repository variables
  such as `GIT_INDEX_FILE` to hooks, so before the commit gate (`.husky/pre-commit` → `pnpm lint`)
  must enumerate `git rev-parse --local-env-vars` and unset each one. Otherwise nested git (or a
  future expansion of the gate that runs tests) inherits the real worktree's index and object paths,
  ignores `cwd`, and can create fixture commits or switch branches in the checkout being committed.
  Branch/profile checks run **before** the scrub; the gate command runs after. *Verify:* `lint-audit`
  enforces the scrub, and a normal commit completes without changing branch or producing fixture
  commits.
- **`cwd` decides which repository a spawned git acts on — never an inherited variable.** Every git
  spawn builds its env with `gitEnv`, which drops the repository-local variables
  `git rev-parse --local-env-vars` names and passes the rest through: `GIT_SSH_COMMAND`/`GIT_ASKPASS`
  say HOW git works, not WHICH repo, and stripping them would break push auth. This is the runtime half
  of the hook scrub, and it is what makes the property hold for callers that never went through the
  hook (CI, a terminal that exported `GIT_DIR`, a daemon started from a hook). **The failure is silent
  and total:** a fixture `git init --bare` once inherited a hook's `GIT_DIR`, reinitialized the real
  checkout as bare (`core.bare=true`, so Porcelain rendered the primary worktree as `(detached)`) and
  wrote fixture commits onto the task branch. The test helper in `git.test.ts` scrubs for the same
  reason — a fixture repo must be immune on its own, whoever spawned the tests. *Verify:* lint-enforced
  (every gateway spawn passes `env: gitEnv(`); `git-env.test.ts` pins the strip list; `git.test.ts` →
  "inherited repository env" runs a fixture under a decoy `GIT_DIR` and asserts the decoy keeps its
  HEAD, branches, index, and `core.bare=false`.
- **Every git invocation sets `GIT_OPTIONAL_LOCKS=0`** (`runGit`). The 3s `gitStatus`/`gitFlow`
  background polls otherwise rewrite `.git/index` under a lock, racing the user's own `pull`/`commit`
  and failing it with `fatal: Unable to write index.`. The flag disables only optional refreshes;
  required locks for real mutations are untouched. *Verify:* lint-enforced — the flag stays in `git.ts`
  and no other shipped `src/backend`/`src/main` module spawns `git` around `runGit`. Tests and
  `src/cli`'s one-shot `rev-parse` are out of scope on purpose (neither polls a live user repo).
  `git.ts` itself is exempt from the spawn half, so a new in-file bypass of `runGit` is invisible to
  the lint — still read a change to `git.ts`.
- **Commit never auto-stages.** `gitCommit` is `git commit -m` on **staged** changes only; staging is
  explicit. Porcelain is a review tool — a silent `git add -A` on commit is surprising.
- **Quick commands run a whitelist** (`QUICK_COMMANDS`), never arbitrary shell. New quick actions are
  added to the whitelist, not passed through.
- **Status listings use `-uall`** in `gitStatus` and `gitDiffFile`'s status probe. The default
  `-unormal` collapses an untracked directory into one `dir/` row; that row reaches the Changes list,
  and `gitDiffFile` then `readFile`s a directory → `EISDIR` (blank tab + error). *Verify:* new
  `git status` calls feeding the changes list keep the flag.

