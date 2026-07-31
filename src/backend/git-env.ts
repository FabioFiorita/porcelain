/**
 * Build the environment for a spawned `git` from this process's own env. Pure and
 * extracted from git.ts (the impure module — it spawns) so the strip list is
 * unit-testable, the same split as terminal-env.
 *
 * CORRECTNESS: git's repository-local variables OVERRIDE `cwd` — a git process
 * that inherits `GIT_DIR` acts on THAT repository no matter which directory it
 * was spawned in. Git exports them to every hook it runs, so anything launched
 * from a hook inherits a pointer at the repo being committed. Porcelain always
 * addresses a repository by `cwd` (a repoPath argument), so an inherited pointer
 * is never right: it silently redirects every read and mutation to another repo.
 *
 * The list mirrors `git rev-parse --local-env-vars`. Other `GIT_*` variables
 * (GIT_SSH_COMMAND, GIT_ASKPASS, GIT_TERMINAL_PROMPT, …) are the user's real
 * configuration and pass through untouched — they say HOW git works, not WHICH
 * repository it works on, and stripping them would break push auth.
 */
const REPO_LOCAL_ENV = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
]

export function gitEnv(
  source: NodeJS.ProcessEnv,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && !REPO_LOCAL_ENV.includes(key)) env[key] = value
  }
  return { ...env, ...overrides }
}
