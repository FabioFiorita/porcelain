import type { TimelineItem } from '@shared/agent-protocol'
import { describe, expect, it } from 'vitest'
import {
  buildChangedFileEntries,
  buildPathTree,
  sumChangedStats,
  toRepoRelative,
  touchedFilesFromItems,
  writtenPathsFromItems,
} from './agent-touched-files'

describe('touchedFilesFromItems', () => {
  it('prefers the last action per path and skips non-file tools', () => {
    const items: TimelineItem[] = [
      { kind: 'tool', id: '1', title: 'Read', detail: '/repo/a.ts', status: 'ok' },
      { kind: 'tool', id: '2', title: 'Edit', detail: '/repo/a.ts', status: 'ok' },
      { kind: 'tool', id: '3', title: 'Write', detail: '/repo/b.ts', status: 'ok' },
      { kind: 'tool', id: '4', title: 'Bash', detail: 'ls', status: 'ok' },
    ]
    expect(touchedFilesFromItems(items)).toEqual([
      { path: '/repo/a.ts', action: 'edit' },
      { path: '/repo/b.ts', action: 'write' },
    ])
  })
})

describe('writtenPathsFromItems', () => {
  it('returns only write/edit paths in first-seen order', () => {
    const items: TimelineItem[] = [
      { kind: 'tool', id: '1', title: 'Read', detail: 'a.ts', status: 'ok' },
      { kind: 'tool', id: '2', title: 'Edit', detail: 'a.ts', status: 'ok' },
      { kind: 'tool', id: '3', title: 'Write', detail: 'b.ts', status: 'ok' },
      { kind: 'tool', id: '4', title: 'Edit', detail: 'a.ts', status: 'ok' },
    ]
    expect(writtenPathsFromItems(items)).toEqual(['a.ts', 'b.ts'])
  })
})

describe('toRepoRelative', () => {
  it('strips the repo prefix', () => {
    expect(toRepoRelative('/repo', '/repo/src/a.ts')).toBe('src/a.ts')
  })
  it('keeps already-relative paths', () => {
    expect(toRepoRelative('/repo', 'src/a.ts')).toBe('src/a.ts')
  })
})

describe('buildChangedFileEntries + path tree', () => {
  it('attaches stats and nests paths', () => {
    const stats = new Map([
      ['packages/a.ts', { additions: 2, deletions: 1 }],
      ['packages/b/c.ts', { additions: 5, deletions: 0 }],
    ])
    const entries = buildChangedFileEntries(
      ['/repo/packages/a.ts', '/repo/packages/b/c.ts'],
      '/repo',
      stats,
    )
    expect(entries).toEqual([
      { path: 'packages/a.ts', additions: 2, deletions: 1 },
      { path: 'packages/b/c.ts', additions: 5, deletions: 0 },
    ])
    expect(sumChangedStats(entries)).toEqual({ additions: 7, deletions: 1, hasStats: true })
    const tree = buildPathTree(entries)
    expect(tree).toHaveLength(1)
    expect(tree[0]?.name).toBe('packages')
    expect(tree[0]?.kind).toBe('dir')
    expect(tree[0]?.additions).toBe(7)
    const kids = tree[0]?.children ?? []
    expect(kids.some((k) => k.name === 'a.ts' && k.kind === 'file')).toBe(true)
    const b = kids.find((k) => k.name === 'b')
    expect(b?.kind).toBe('dir')
    expect(b?.children?.[0]?.name).toBe('c.ts')
  })
})
