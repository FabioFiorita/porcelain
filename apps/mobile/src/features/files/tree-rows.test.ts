import { describe, expect, it } from 'vitest'

import { ancestorPaths, fileTreeItems } from '@/features/files/tree-rows'
import type { DirEntry } from '@/lib/daemon/procedures/files'

function entry(path: string, kind: 'dir' | 'file', extra: Partial<DirEntry> = {}): DirEntry {
  return {
    hidden: false,
    kind,
    name: path.split('/').at(-1) ?? path,
    path,
    pinned: false,
    ...extra,
  }
}

const root = '/repo'

const listing = new Map<string, readonly DirEntry[]>([
  ['/repo', [entry('/repo/src', 'dir'), entry('/repo/README.md', 'file')]],
  ['/repo/src', [entry('/repo/src/lib', 'dir'), entry('/repo/src/index.ts', 'file')]],
  ['/repo/src/lib', [entry('/repo/src/lib/util.ts', 'file')]],
])

describe('fileTreeItems', () => {
  it('shows only the root while nothing is open', () => {
    const items = fileTreeItems({ entriesByPath: listing, expanded: new Set(), root })
    expect(items.map((item) => item.key)).toEqual(['/repo/src', '/repo/README.md'])
  })

  it('inlines an open folder’s children at the next depth', () => {
    const items = fileTreeItems({
      entriesByPath: listing,
      expanded: new Set(['/repo/src']),
      root,
    })

    expect(items.map((item) => item.key)).toEqual([
      '/repo/src',
      '/repo/src/lib',
      '/repo/src/index.ts',
      '/repo/README.md',
    ])
    expect(items.map((item) => ('depth' in item ? item.depth : -1))).toEqual([0, 1, 1, 0])
  })

  it('counts a folder only once its listing has arrived', () => {
    const open = fileTreeItems({ entriesByPath: listing, expanded: new Set(['/repo/src']), root })
    const closed = fileTreeItems({
      entriesByPath: new Map([['/repo', listing.get('/repo') ?? []]]),
      expanded: new Set(),
      root,
    })

    expect(open[0]?.trailing).toEqual([{ text: '2' }])
    expect(closed[0]?.trailing).toBeUndefined()
  })

  it('does not descend into a folder whose listing has not landed yet', () => {
    const items = fileTreeItems({
      entriesByPath: new Map([['/repo', listing.get('/repo') ?? []]]),
      expanded: new Set(['/repo/src']),
      root,
    })
    expect(items.map((item) => item.key)).toEqual(['/repo/src', '/repo/README.md'])
  })

  it('dims a hidden entry', () => {
    const items = fileTreeItems({
      entriesByPath: new Map([['/repo', [entry('/repo/.env', 'file', { hidden: true })]]]),
      expanded: new Set(),
      root,
    })
    expect(items[0]).toMatchObject({ dimmed: true })
  })
})

describe('ancestorPaths', () => {
  it('lists the folders a reveal has to open, outermost first', () => {
    expect(ancestorPaths(root, '/repo/src/lib/util.ts')).toEqual(['/repo/src', '/repo/src/lib'])
  })

  it('has nothing to open for a file at the root', () => {
    expect(ancestorPaths(root, '/repo/README.md')).toEqual([])
  })

  it('refuses a path outside the repo', () => {
    expect(ancestorPaths(root, '/elsewhere/file.ts')).toEqual([])
  })
})
