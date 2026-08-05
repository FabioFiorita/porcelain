import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { PROJECT_PORCELAIN_DIR } from '@shared/project-porcelain'
import { gitCommonDir, gitTrackedUnder } from '../git/git'

/**
 * Hide the companion from git in THIS clone, via `$GIT_COMMON_DIR/info/exclude`.
 *
 * Opening a repo in Porcelain must not change that repo's `git status`. Before
 * this, the first board move or agent review left `?? .porcelain/` sitting in
 * the human's tree — "I opened it to look and it started adding things to my
 * project" is a fair reaction, and a bad first five minutes.
 *
 * Why `info/exclude` and not the root `.gitignore`: the root file is TRACKED.
 * Writing to it would not merely add noise, it would put Porcelain in the
 * human's diff and then in their history — the exact problem, made permanent.
 * `info/exclude` is per-clone and never committed.
 *
 * Worktrees: git resolves the whole `info/` directory through `$GIT_COMMON_DIR`
 * (gitrepository-layout), so there is no per-worktree exclude file and one entry
 * covers every worktree of a clone — including ones created later. That is also
 * the semantics we want: whether to share companion data with the team is a
 * property of the project, not of a branch.
 */

/** The line we manage. Directory form — git then never descends into it. */
const EXCLUDE_LINE = `${PROJECT_PORCELAIN_DIR}/`

const MARKER = '# Porcelain companion — hidden from git in this clone only.'

async function excludeFilePath(repoPath: string): Promise<string | null> {
  const common = await gitCommonDir(repoPath)
  if (common === null) return null
  return join(isAbsolute(common) ? common : resolve(repoPath, common), 'info', 'exclude')
}

async function readLines(path: string): Promise<string[]> {
  try {
    return (await readFile(path, 'utf8')).split('\n')
  } catch {
    // No exclude file yet (or unreadable) — treat as empty and write a fresh one.
    return []
  }
}

function hasLine(lines: string[]): boolean {
  return lines.some((line) => {
    const trimmed = line.trim()
    return trimmed === EXCLUDE_LINE || trimmed === PROJECT_PORCELAIN_DIR
  })
}

/** True when git is currently blind to `.porcelain/` in this clone. */
export async function isCompanionHidden(repoPath: string): Promise<boolean> {
  const path = await excludeFilePath(repoPath)
  if (path === null) return false
  return hasLine(await readLines(path))
}

/** Add the exclude line. Returns false when it was already there (or not a repo). */
export async function hideCompanion(repoPath: string): Promise<boolean> {
  const path = await excludeFilePath(repoPath)
  if (path === null) return false
  const lines = await readLines(path)
  if (hasLine(lines)) return false
  const body = lines.join('\n').replace(/\n+$/, '')
  const next =
    body === '' ? `${MARKER}\n${EXCLUDE_LINE}\n` : `${body}\n${MARKER}\n${EXCLUDE_LINE}\n`
  await writeFile(path, next)
  return true
}

/**
 * Drop the exclude line (and our marker comment), leaving every other rule the
 * human or another tool put there untouched.
 */
export async function unhideCompanion(repoPath: string): Promise<boolean> {
  const path = await excludeFilePath(repoPath)
  if (path === null) return false
  const lines = await readLines(path)
  if (!hasLine(lines)) return false
  const kept = lines.filter((line) => {
    const trimmed = line.trim()
    return trimmed !== EXCLUDE_LINE && trimmed !== PROJECT_PORCELAIN_DIR && trimmed !== MARKER
  })
  const body = kept.join('\n').replace(/\n+$/, '')
  await writeFile(path, body === '' ? '' : `${body}\n`)
  return true
}

/**
 * First-write hook: hide the companion unless this repo has already opted in.
 *
 * A repo that already TRACKS companion files was deliberately shared by someone
 * — excluding it there would leave a confusing half-state (tracked files still
 * showing, new ones invisible), so it is left alone. Memoized per repo: this
 * runs from the same path as every companion write.
 */
const decided = new Map<string, Promise<void>>()

export function ensureCompanionHidden(repoPath: string): Promise<void> {
  const inFlight = decided.get(repoPath)
  if (inFlight) return inFlight
  const run = (async (): Promise<void> => {
    const tracked = await gitTrackedUnder(repoPath, PROJECT_PORCELAIN_DIR)
    if (tracked.length > 0) return
    await hideCompanion(repoPath)
  })().catch(() => {
    // Never let a git or fs hiccup block a companion write; retry next boot.
    decided.delete(repoPath)
  })
  decided.set(repoPath, run)
  return run
}

/** Test seam: forget which repos this process has already decided about. */
export function resetCompanionHiddenMemo(): void {
  decided.clear()
}
