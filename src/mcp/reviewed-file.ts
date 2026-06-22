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

type Reviewed = Record<string, string[]>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function reviewedPath(): string {
  return process.env.PORCELAIN_REVIEWED ?? join(homedir(), '.porcelain', 'reviewed.json')
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
      all[repoPath] = value.filter((p): p is string => typeof p === 'string')
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
    return `No files marked reviewed for ${repoPath}. The human checks off files as they review them in Porcelain (the Changes / Feature lists); changed files that aren't checked off are still unreviewed. The marks describe the working tree and reset when changes are committed.`
  }
  const list = paths.map((path) => `- ${path}`).join('\n')
  return `${paths.length} file(s) marked reviewed by the human for ${repoPath} (any other changed file is still unreviewed; marks reset on commit):\n${list}`
}
