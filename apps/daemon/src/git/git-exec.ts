import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { gitEnv } from './git-env'

const execFileAsync = promisify(execFile)

/** Shared read/mutation spawn chokepoint; callers supply only fixed git arguments. */
export async function runGit(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repoPath,
    maxBuffer: 64 * 1024 * 1024,
    // GIT_OPTIONAL_LOCKS=0 stops background reads (status/diff polls) from
    // opportunistically rewriting .git/index, which otherwise races user
    // writes (pull/commit) and fails them with "fatal: Unable to write index.".
    // It disables only the optional index refresh — required locks for real
    // mutations (pull/commit/checkout) are untouched.
    // gitEnv drops any inherited GIT_DIR/GIT_INDEX_FILE/… so `cwd` above stays
    // the only thing that decides which repository this acts on.
    env: gitEnv(process.env, { GIT_OPTIONAL_LOCKS: '0' }),
  })
  return stdout
}

/**
 * Reuse the `previous` array object when a refresh produced a content-identical
 * list. The stale-while-revalidate refresh allocates a fresh array every tick;
 * without this, an identity-keyed downstream memo (`searchCandidates` compares
 * `cached.files === files`) would rebuild on every no-op refresh. Same length +
 * element-wise equality — a linear scan, cheap next to the git spawn that fed it.
 */
export function reuseIfUnchanged(previous: string[] | undefined, next: string[]): string[] {
  if (previous && previous.length === next.length && previous.every((p, i) => p === next[i])) {
    return previous
  }
  return next
}

export function gitErrorOutput(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    if ('stderr' in error && typeof error.stderr === 'string' && error.stderr.trim() !== '') {
      return error.stderr.trim()
    }
    if ('stdout' in error && typeof error.stdout === 'string' && error.stdout.trim() !== '') {
      return error.stdout.trim()
    }
  }
  return String(error)
}

/**
 * Run a git mutation and rethrow git's own stderr/stdout (via gitErrorOutput) so the
 * UI can surface the message (e.g. a dirty-tree checkout refusal). Read-only helpers
 * call runGit directly; the mutating ones go through this so error surfacing is uniform.
 */
export async function runGitChecked(repoPath: string, args: string[]): Promise<string> {
  try {
    return await runGit(repoPath, args)
  } catch (error) {
    throw new Error(gitErrorOutput(error))
  }
}
