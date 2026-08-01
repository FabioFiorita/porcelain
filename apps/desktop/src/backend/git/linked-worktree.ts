import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'

/**
 * True when `repoPath` is a LINKED git worktree rather than a primary checkout.
 *
 * The probe is a single `stat`, never a `git` spawn: a linked worktree's `.git`
 * is a FILE (`gitdir: …`) where a primary checkout has a directory. `recentRepos`
 * runs this per entry on a hot path, so the cost has to stay at one syscall.
 */
export async function isLinkedWorktree(repoPath: string): Promise<boolean> {
  try {
    return (await stat(join(repoPath, '.git'))).isFile()
  } catch {
    return false
  }
}

/**
 * The primary checkout a linked worktree belongs to, or null when `repoPath` is not
 * one (or its administrative files are unreadable — callers treat that as "nothing
 * to do", never an error). Read from git's own files instead of a spawn: `.git` holds
 * `gitdir: <repo>/.git/worktrees/<name>`, and that directory's `commondir` points at
 * the common `.git` dir, whose parent is the primary checkout. A bare-repo family
 * yields a directory holding no settings — a harmless no-op, not a wrong answer.
 */
export async function primaryCheckoutPath(repoPath: string): Promise<string | null> {
  try {
    const pointer = await readFile(join(repoPath, '.git'), 'utf8')
    const gitdir = pointer.trim().replace(/^gitdir:\s*/, '')
    if (gitdir === '' || gitdir === pointer.trim()) return null
    const worktreeGitDir = isAbsolute(gitdir) ? gitdir : resolve(repoPath, gitdir)
    const commondir = (await readFile(join(worktreeGitDir, 'commondir'), 'utf8')).trim()
    if (commondir === '') return null
    const common = isAbsolute(commondir) ? commondir : resolve(worktreeGitDir, commondir)
    return dirname(common)
  } catch {
    return null
  }
}
