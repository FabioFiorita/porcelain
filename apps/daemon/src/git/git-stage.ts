import { runGit, runGitChecked } from './git-exec'

/** Stage every change (tracked + untracked). Throws git's output for the UI. */
export async function gitStageAll(repoPath: string): Promise<void> {
  await runGitChecked(repoPath, ['add', '-A'])
}

/** Unstage every change (reset the whole index to HEAD). Throws git's output for the UI. */
export async function gitUnstageAll(repoPath: string): Promise<void> {
  await runGitChecked(repoPath, ['reset', '-q'])
}

/** Stage a single path. Throws git's output for the UI. */
export async function gitStageFile(repoPath: string, path: string): Promise<void> {
  await runGitChecked(repoPath, ['add', '--', path])
}

/** Unstage a single path (restore the index entry from HEAD). */
export async function gitUnstageFile(repoPath: string, path: string): Promise<void> {
  await runGitChecked(repoPath, ['restore', '--staged', '--', path])
}

/**
 * `$GIT_COMMON_DIR` for this checkout, or null outside a repo. Linked worktrees
 * have a `.git` FILE, not a directory, and git resolves `info/` through the
 * common dir — so anything writing into `info/` must ask git where that is
 * rather than assuming `<repo>/.git`.
 */
export async function gitCommonDir(repoPath: string): Promise<string | null> {
  try {
    const out = (await runGit(repoPath, ['rev-parse', '--git-common-dir'])).trim()
    return out === '' ? null : out
  } catch {
    return null
  }
}

/** Repo-relative paths under `path` that git currently tracks. Empty outside a repo. */
export async function gitTrackedUnder(repoPath: string, path: string): Promise<string[]> {
  try {
    const out = await runGit(repoPath, ['ls-files', '-z', '--', path])
    return out.split('\0').filter((p) => p !== '')
  } catch {
    return []
  }
}

/**
 * Stop tracking `path` while leaving the working-tree file alone — the index half
 * of flipping a companion channel to Local. Without this the toggle would be a
 * lie: `.gitignore` has no effect on an already-tracked file, so the UI would say
 * "local" while every board move still landed in everyone's diff.
 *
 * `--ignore-unmatch` makes it idempotent (an untracked channel is already local),
 * `-r` covers a directory channel, and `--cached` is what keeps
 * the file on disk. It STAGES a deletion — that is the honest meaning of "stop
 * sharing this", and the caller tells the human so.
 */
export async function gitUntrackKeepingFile(repoPath: string, path: string): Promise<string[]> {
  const tracked = await gitTrackedUnder(repoPath, path)
  if (tracked.length === 0) return []
  await runGitChecked(repoPath, ['rm', '--cached', '-r', '-q', '--ignore-unmatch', '--', path])
  return tracked
}

/**
 * Stage `path` past `.gitignore`. Reviews are Local by default, so publishing one
 * has to force-add it; nothing else in the app force-adds, because overriding a
 * human's ignore rules is only defensible when the human just asked for exactly
 * this path.
 */
export async function gitForceStage(repoPath: string, path: string): Promise<void> {
  await runGitChecked(repoPath, ['add', '-f', '--', path])
}

/**
 * Does `path` exist in the HEAD commit? Distinguishes a tracked file (discardable
 * by reverting to HEAD) from a brand-new one (no committed version to revert to).
 * False on an unborn branch (no HEAD yet) — everything is "new" there.
 */
export async function gitFileInHead(repoPath: string, path: string): Promise<boolean> {
  try {
    await runGit(repoPath, ['cat-file', '-e', `HEAD:${path}`])
    return true
  } catch {
    return false
  }
}

/**
 * Discard a tracked file's changes: reset both the index and the working tree to
 * the committed version. Reverts staged + unstaged edits and restores a deletion.
 */
export async function gitRestoreFromHead(repoPath: string, path: string): Promise<void> {
  await runGitChecked(repoPath, ['restore', '--staged', '--worktree', '--source=HEAD', '--', path])
}

/**
 * Drop any staged entry for `path` (resets the index to HEAD for it); leaves the
 * working-tree file in place. A no-op for an untracked path. Used when discarding a
 * new file: unstage it here, then the caller trashes the working copy.
 */
export async function gitResetPath(repoPath: string, path: string): Promise<void> {
  await runGitChecked(repoPath, ['reset', '-q', '--', path])
}

/** Commit staged changes. Throws git's output so the UI can show it. */
export async function gitCommit(repoPath: string, message: string): Promise<void> {
  await runGitChecked(repoPath, ['commit', '-m', message])
}
