export type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'

export interface ChangedFile {
  path: string
  status: FileStatus
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
  return porcelainZ
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const xy = entry.slice(0, 2)
      const path = entry.slice(3)
      if (xy === '??') return { path, status: 'untracked' as const }
      const code = xy.trim().charAt(0)
      return { path, status: statusByCode[code] ?? ('modified' as const) }
    })
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
