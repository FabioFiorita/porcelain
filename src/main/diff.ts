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
