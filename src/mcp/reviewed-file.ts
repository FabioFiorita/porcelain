import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Builtins only — see protocol.ts. The reviewed-marks channel: the repo-relative file
// paths the human has checked off as reviewed in Porcelain (the per-file marks in the
// Changes / Feature lists, reviewed-store.ts), READ-ONLY here. ONE-WAY, app→agent — the
// human marks files reviewed in Porcelain; the agent reads them to know what's already
// been vetted vs. still needs a look. Like the notes channel the app is the SOLE writer,
// so there is no write tool and nothing to flip back. Lenient parse of our own file:
// skip malformed entries, never throw.
//
// A mark is `{ path, fingerprint }` (the fingerprint content-keys the reviewed diff so
// the app can prune stale ticks); a legacy mark is a bare path string. We can't run git,
// so we expose only the path list — the app's reconcile+write-through keeps this file
// truthful (stale marks are already gone from disk by the time we read).

type Reviewed = Record<string, string[]>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function reviewedPath(): string {
  return process.env.PORCELAIN_REVIEWED ?? join(homedir(), '.porcelain', 'reviewed.json')
}

// A mark's path from either the object shape or a legacy bare string; null when neither.
function entryPath(entry: unknown): string | null {
  if (typeof entry === 'string') return entry
  if (isRecord(entry) && typeof entry.path === 'string') return entry.path
  return null
}

function readAll(): Reviewed {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(reviewedPath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: Reviewed = {}
  for (const [repoPath, value] of Object.entries(parsed)) {
    if (Array.isArray(value))
      all[repoPath] = value.map(entryPath).filter((p): p is string => p !== null)
  }
  return all
}

/** The repo-relative paths the human has marked reviewed ([] when none / file absent). */
export function readReviewed(repoPath: string): string[] {
  return readAll()[repoPath] ?? []
}

/**
 * Render the reviewed marks for `get_reviewed_files`: the file list (or a hint when
 * empty). These are the working-tree files the human has checked off in Porcelain;
 * anything changed but absent here is not yet reviewed, and the marks reset on commit.
 */
export function describeReviewed(repoPath: string, paths: string[]): string {
  if (paths.length === 0) {
    return `No files marked reviewed for ${repoPath}. The human checks off files as they review them in Porcelain (the Changes / Feature lists); changed files that aren't checked off are still unreviewed. A mark is content-keyed to the file's changes, so it clears automatically once those changes are committed or edited further.`
  }
  const list = paths.map((path) => `- ${path}`).join('\n')
  return `${paths.length} file(s) marked reviewed by the human for ${repoPath} (any other changed file is still unreviewed; a mark clears once its file's changes are committed or edited further):\n${list}`
}
