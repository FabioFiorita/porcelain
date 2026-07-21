import { fileName } from '@renderer/lib/paths'
import type { TimelineItem } from '@shared/agent-protocol'

/** Titles whose `detail` is a file path the user can open in the viewer. */
export const FILE_TOOL_TITLES = new Set(['Read', 'Edit', 'Write', 'Edit notebook'])

/** Tool titles that *write* (not merely read) — used for turn “changed files” previews. */
export const WRITE_TOOL_TITLES = new Set(['Edit', 'Write', 'Edit notebook'])

export type TouchedFile = {
  path: string
  /** Last action against this path in timeline order (Write/Edit beat a prior Read). */
  action: 'read' | 'edit' | 'write'
}

/**
 * Deduped file paths the agent has Read/Edit/Written (timeline order, last action wins).
 * Pure so it's unit-testable without mounting UI.
 */
export function touchedFilesFromItems(items: readonly TimelineItem[]): TouchedFile[] {
  const byPath = new Map<string, TouchedFile>()
  for (const item of items) {
    if (item.kind !== 'tool') continue
    if (!FILE_TOOL_TITLES.has(item.title)) continue
    const path = item.detail?.trim()
    if (path === undefined || path === '') continue
    const action: TouchedFile['action'] =
      item.title === 'Write' ? 'write' : item.title === 'Read' ? 'read' : 'edit'
    byPath.set(path, { path, action })
  }
  return [...byPath.values()]
}

/** Write/edit paths only (for “what this turn changed” previews). */
export function writtenPathsFromItems(items: readonly TimelineItem[]): string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (item.kind !== 'tool') continue
    if (!WRITE_TOOL_TITLES.has(item.title)) continue
    const path = item.detail?.trim()
    if (path === undefined || path === '') continue
    if (seen.has(path)) continue
    seen.add(path)
    paths.push(path)
  }
  return paths
}

/** Normalize a tool path (often absolute) to a repo-relative path when possible. */
export function toRepoRelative(repoPath: string | null | undefined, path: string): string {
  if (repoPath !== null && repoPath !== undefined && path.startsWith(`${repoPath}/`)) {
    return path.slice(repoPath.length + 1)
  }
  // Already relative, or outside the repo — keep as-is for display/open attempts.
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) {
    // Absolute but not under repo — still show basename-friendly path
    return path
  }
  return path
}

export type FileStat = { path: string; additions?: number; deletions?: number }

export type ChangedFileEntry = {
  /** Repo-relative when possible. */
  path: string
  additions?: number
  deletions?: number
}

/**
 * Join tool write paths with optional git flow stats (by relative path).
 * Paths that aren't dirty still appear (agent wrote them; tree may already be clean).
 */
export function buildChangedFileEntries(
  writePaths: readonly string[],
  repoPath: string | null | undefined,
  statsByRelPath: ReadonlyMap<string, { additions?: number; deletions?: number }>,
): ChangedFileEntry[] {
  const out: ChangedFileEntry[] = []
  const seen = new Set<string>()
  for (const raw of writePaths) {
    const rel = toRepoRelative(repoPath, raw)
    if (seen.has(rel)) continue
    seen.add(rel)
    const stat = statsByRelPath.get(rel)
    out.push({
      path: rel,
      additions: stat?.additions,
      deletions: stat?.deletions,
    })
  }
  return out
}

export type PathTreeNode = {
  name: string
  /** Full relative path for leaves; dir path for dirs. */
  path: string
  kind: 'dir' | 'file'
  additions?: number
  deletions?: number
  children?: PathTreeNode[]
}

/** Build a nested path tree (sorted dirs/files) for the changed-files card. */
export function buildPathTree(entries: readonly ChangedFileEntry[]): PathTreeNode[] {
  type Mutable = {
    name: string
    path: string
    kind: 'dir' | 'file'
    additions?: number
    deletions?: number
    children?: Map<string, Mutable>
  }
  const root = new Map<string, Mutable>()

  for (const entry of entries) {
    const parts = entry.path.split('/').filter((p) => p.length > 0)
    if (parts.length === 0) continue
    let level = root
    let prefix = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part === undefined) continue
      prefix = prefix === '' ? part : `${prefix}/${part}`
      const isLeaf = i === parts.length - 1
      let node = level.get(part)
      if (!node) {
        node = {
          name: part,
          path: prefix,
          kind: isLeaf ? 'file' : 'dir',
          children: isLeaf ? undefined : new Map(),
        }
        level.set(part, node)
      }
      if (isLeaf) {
        node.kind = 'file'
        node.additions = entry.additions
        node.deletions = entry.deletions
        node.children = undefined
      } else {
        if (node.children === undefined) node.children = new Map()
        // Roll up stats on dirs
        if (entry.additions !== undefined) {
          node.additions = (node.additions ?? 0) + entry.additions
        }
        if (entry.deletions !== undefined) {
          node.deletions = (node.deletions ?? 0) + entry.deletions
        }
        level = node.children
      }
    }
  }

  const toNodes = (map: Map<string, Mutable>): PathTreeNode[] => {
    const nodes = [...map.values()].map((n): PathTreeNode => {
      if (n.kind === 'dir' && n.children) {
        return {
          name: n.name,
          path: n.path,
          kind: 'dir',
          additions: n.additions,
          deletions: n.deletions,
          children: toNodes(n.children),
        }
      }
      return {
        name: n.name,
        path: n.path,
        kind: 'file',
        additions: n.additions,
        deletions: n.deletions,
      }
    })
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return nodes
  }

  return toNodes(root)
}

export function sumChangedStats(entries: readonly ChangedFileEntry[]): {
  additions: number
  deletions: number
  hasStats: boolean
} {
  let additions = 0
  let deletions = 0
  let hasStats = false
  for (const e of entries) {
    if (e.additions !== undefined) {
      additions += e.additions
      hasStats = true
    }
    if (e.deletions !== undefined) {
      deletions += e.deletions
      hasStats = true
    }
  }
  return { additions, deletions, hasStats }
}

/** Display basename for a path (shared with Session Files). */
export function changedFileLabel(path: string): string {
  return fileName(path)
}
