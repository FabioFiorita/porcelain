import { isAbsolute, relative } from 'node:path'
import {
  type ChangedFile,
  type Commit,
  type DiffHunk,
  type DiffStat,
  parseLog,
  parseNameStatus,
  parseNumstat,
  parseStatus,
  parseUnifiedDiff,
} from './diff'
import { runGit } from './git-exec'

export async function gitLog(repoPath: string, limit: number): Promise<Commit[]> {
  return parseLog(
    await runGit(repoPath, [
      'log',
      `-n${limit}`,
      '--pretty=format:%H%x1f%an%x1f%ar%x1f%s%x1e',
      '--date=relative',
    ]),
  )
}

/** Commit history for a single file — the History tab's file timeline.
 *  `--follow` tracks the file across renames so the timeline doesn't stop at a
 *  move. `filePath` arrives as an absolute viewer-tab path (or repo-relative);
 *  we relativize it so the pathspec resolves against the work-tree root. Same
 *  pretty-format as gitLog, so parseLog/Commit are reused. */
export async function gitFileLog(
  repoPath: string,
  filePath: string,
  limit: number,
): Promise<Commit[]> {
  const pathspec = isAbsolute(filePath) ? relative(repoPath, filePath) : filePath
  return parseLog(
    await runGit(repoPath, [
      'log',
      `-n${limit}`,
      '--follow',
      '--pretty=format:%H%x1f%an%x1f%ar%x1f%s%x1e',
      '--date=relative',
      '--',
      pathspec,
    ]),
  )
}

/** Full commit message (subject + body) for one commit, trailing newline trimmed. */
export async function gitCommitMessage(repoPath: string, hash: string): Promise<string> {
  const out = await runGit(repoPath, ['show', '-s', '--format=%B', '--no-color', hash])
  return out.replace(/\n+$/, '')
}

export async function gitCommitFiles(repoPath: string, hash: string): Promise<ChangedFile[]> {
  return parseNameStatus(
    await runGit(repoPath, ['show', hash, '--name-status', '--format=', '-z', '--no-color']),
  )
}

export async function gitCommitDiff(
  repoPath: string,
  hash: string,
  filePath: string,
): Promise<DiffHunk[]> {
  return parseUnifiedDiff(
    await runGit(repoPath, ['show', hash, '--no-color', '--format=', '--', filePath]),
  )
}

export async function gitStatus(repoPath: string): Promise<ChangedFile[]> {
  // --untracked-files=all lists each new file individually; the default
  // (-unormal) collapses an untracked directory into a single `dir/` row, which
  // the changes list would then try to diff as a file (readFile → EISDIR).
  // `.porcelain/` companion files are included like any other path so they can
  // be reviewed, staged, and shared via git (evidence stays ignored by default
  // via `.porcelain/.gitignore`).
  return parseStatus(await runGit(repoPath, ['status', '--porcelain=v1', '-uall', '-z']))
}

export async function gitNumstat(repoPath: string): Promise<DiffStat[]> {
  return parseNumstat(await runGit(repoPath, ['diff', 'HEAD', '--numstat', '-z']))
}

/**
 * +/- counts per file for a single commit vs its first parent.
 * Root commits (no parent) diff against the empty tree — returns stats normally.
 */
export async function gitCommitNumstat(repoPath: string, hash: string): Promise<DiffStat[]> {
  return parseNumstat(await runGit(repoPath, ['show', '--numstat', '--format=', '-z', hash]))
}
