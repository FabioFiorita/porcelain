export interface FuzzyResult {
  path: string
  score: number
}

export interface SearchResult {
  path: string
  kind: 'file' | 'dir'
}

/**
 * Every ancestor directory of the given repo-relative files, deduped, with no
 * trailing slash. Lets the Cmd+P finder surface folders (e.g. `src`) alongside
 * files, since `git ls-files` only ever lists files. Order is unspecified —
 * `fuzzySearch` re-ranks the combined candidate set anyway.
 */
export function directoriesOf(files: readonly string[]): string[] {
  const dirs = new Set<string>()
  for (const file of files) {
    let slash = file.lastIndexOf('/')
    while (slash > 0) {
      dirs.add(file.slice(0, slash))
      slash = file.lastIndexOf('/', slash - 1)
    }
  }
  return [...dirs]
}

/**
 * Subsequence fuzzy match: every query char must appear in order in the path.
 * Scoring favors contiguous runs, basename hits, and shorter paths, so typing
 * the end of a file name (e.g. "widget.spec") ranks its file first.
 */
export function fuzzyScore(query: string, path: string): number | null {
  const q = query.toLowerCase()
  const p = path.toLowerCase()
  if (q.length === 0) return 0

  const basenameStart = p.lastIndexOf('/') + 1
  let score = 0
  let pi = 0
  let prevHit = -2

  for (const char of q) {
    const found = p.indexOf(char, pi)
    if (found === -1) return null
    score += found === prevHit + 1 ? 5 : 1
    if (found >= basenameStart) score += 2
    prevHit = found
    pi = found + 1
  }

  return score - p.length / 100
}

export function fuzzySearch(query: string, paths: readonly string[], limit: number): FuzzyResult[] {
  const results: FuzzyResult[] = []
  for (const path of paths) {
    const score = fuzzyScore(query, path)
    if (score !== null) results.push({ path, score })
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}
