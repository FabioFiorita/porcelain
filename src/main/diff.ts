export type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'

export interface ChangedFile {
  path: string
  status: FileStatus
  /**
   * Working-tree staging state, derived from the porcelain XY columns. Only set
   * for `git status` output (parseStatus); commit-file lists leave them
   * undefined since staging is meaningless there. A file may be both (e.g. `MM`).
   */
  staged?: boolean
  unstaged?: boolean
}

export type DiffLineKind = 'context' | 'add' | 'del'

export interface DiffLine {
  kind: DiffLineKind
  oldLine: number | null
  newLine: number | null
  text: string
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

const statusByCode: Record<string, FileStatus> = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
}

export function parseStatus(porcelainZ: string): ChangedFile[] {
  const segments = porcelainZ.split('\0').filter(Boolean)
  const files: ChangedFile[] = []
  for (let i = 0; i < segments.length; i++) {
    const entry = segments[i] ?? ''
    const xy = entry.slice(0, 2)
    const path = entry.slice(3)
    if (xy === '??') {
      files.push({ path, status: 'untracked', staged: false, unstaged: true })
      continue
    }
    const code = xy.trim().charAt(0)
    // Renames/copies carry the old path as the next NUL field; the new path is
    // in this segment. Consume the old-path field so it isn't read as a file.
    if (code === 'R' || code === 'C') i += 1
    files.push({
      path,
      status: statusByCode[code] ?? 'modified',
      staged: xy.charAt(0) !== ' ',
      unstaged: xy.charAt(1) !== ' ',
    })
  }
  return files
}

export interface Commit {
  hash: string
  author: string
  date: string
  subject: string
}

/** Parse `git log --pretty=format:%H%x1f%an%x1f%ar%x1f%s%x1e` output. */
export function parseLog(out: string): Commit[] {
  return out
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash = '', author = '', date = '', subject = ''] = entry.split('\x1f')
      return { hash, author, date, subject }
    })
    .filter((c) => c.hash !== '')
}

/** Parse `git show --name-status --format= -z` output into changed files. */
export function parseNameStatus(out: string): ChangedFile[] {
  const parts = out.split('\0').filter(Boolean)
  const files: ChangedFile[] = []
  for (let i = 0; i < parts.length; i += 2) {
    const code = parts[i]?.charAt(0) ?? ''
    let path = parts[i + 1]
    if (code === 'R') {
      // renames carry old and new path; show the new one
      path = parts[i + 2]
      i += 1
    }
    if (path) files.push({ path, status: statusByCode[code] ?? 'modified' })
  }
  return files
}

export interface DiffStat {
  path: string
  additions: number
  deletions: number
}

/** Parse `git diff --numstat -z` output (binary files report "-"). */
export function parseNumstat(out: string): DiffStat[] {
  const records = out.split('\0').filter(Boolean)
  const stats: DiffStat[] = []
  for (let i = 0; i < records.length; i++) {
    const [additions = '-', deletions = '-', path = ''] = (records[i] ?? '').split('\t')
    const adds = additions === '-' ? 0 : Number(additions)
    const dels = deletions === '-' ? 0 : Number(deletions)
    if (path === '') {
      // Rename: this record is `adds\tdels\t`; the next two records are old, new.
      const newPath = records[i + 2]
      i += 2
      if (newPath) stats.push({ path: newPath, additions: adds, deletions: dels })
      continue
    }
    stats.push({ path, additions: adds, deletions: dels })
  }
  return stats
}

export interface Worktree {
  path: string
  branch: string
}

/** Parse `git worktree list --porcelain` output. */
export function parseWorktrees(out: string): Worktree[] {
  return out
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n')
      const path = lines.find((l) => l.startsWith('worktree '))?.slice('worktree '.length) ?? ''
      const branchRef = lines.find((l) => l.startsWith('branch '))?.slice('branch '.length)
      const branch = branchRef?.replace('refs/heads/', '') ?? '(detached)'
      return { path, branch }
    })
    .filter((w) => w.path !== '')
}

export interface GrepMatch {
  path: string
  line: number
  text: string
}

/** Parse `git grep -n` output (`path:line:text` rows). */
export function parseGrep(out: string): GrepMatch[] {
  const matches: GrepMatch[] = []
  for (const row of out.split('\n')) {
    if (row === '') continue
    const first = row.indexOf(':')
    const second = row.indexOf(':', first + 1)
    if (first === -1 || second === -1) continue
    const line = Number(row.slice(first + 1, second))
    if (!Number.isInteger(line) || line < 1) continue
    matches.push({ path: row.slice(0, first), line, text: row.slice(second + 1) })
  }
  return matches
}

export function parseUnifiedDiff(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = []
  let current: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of diff.split('\n')) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1])
      newLine = Number(hunkMatch[2])
      current = { header: line, lines: [] }
      hunks.push(current)
      continue
    }
    if (!current) continue
    if (line.startsWith('+')) {
      current.lines.push({ kind: 'add', oldLine: null, newLine: newLine++, text: line.slice(1) })
    } else if (line.startsWith('-')) {
      current.lines.push({ kind: 'del', oldLine: oldLine++, newLine: null, text: line.slice(1) })
    } else if (line.startsWith(' ')) {
      current.lines.push({
        kind: 'context',
        oldLine: oldLine++,
        newLine: newLine++,
        text: line.slice(1),
      })
    }
  }
  return hunks
}

export function synthesizeAddDiff(content: string): DiffHunk[] {
  const lines = content.split('\n')
  if (lines.at(-1) === '') lines.pop()
  if (lines.length === 0) return []
  return [
    {
      header: `@@ -0,0 +1,${lines.length} @@`,
      lines: lines.map((text, i) => ({
        kind: 'add' as const,
        oldLine: null,
        newLine: i + 1,
        text,
      })),
    },
  ]
}
