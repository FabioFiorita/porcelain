import { describe, expect, it } from 'vitest'

import { flowEntryItems } from '@/features/changes/lib/flow-rows'
import type { FlowGroup } from '@/lib/daemon/procedures/changes'

const groups: FlowGroup[] = [
  {
    files: [
      {
        additions: 40,
        connects: [],
        deletions: 4,
        path: 'apps/web/src/changes-list.tsx',
        status: 'modified',
      },
      {
        additions: 12,
        connects: [],
        deletions: 0,
        path: 'apps/web/src/new-file.tsx',
        status: 'added',
      },
    ],
    layer: 'entry point',
  },
  {
    files: [{ additions: 3, connects: [], deletions: 9, path: 'read-dir.ts', status: 'modified' }],
    layer: 'data',
  },
]

describe('flowEntryItems', () => {
  it('keeps the daemon’s layer and file order', () => {
    const items = flowEntryItems(groups)
    expect(items.map((item) => item.key)).toEqual([
      'layer:entry point',
      'apps/web/src/changes-list.tsx',
      'apps/web/src/new-file.tsx',
      'layer:data',
      'read-dir.ts',
    ])
  })

  it('totals a layer in its section', () => {
    const [section] = flowEntryItems(groups)
    expect(section?.trailing).toEqual([{ text: '2 files' }, { text: '+52 −4' }])
  })

  it('leads a file with its git status, not its file type', () => {
    const items = flowEntryItems(groups)
    expect(items[1]).toMatchObject({ symbol: { name: 'pencil.circle' } })
    expect(items[2]).toMatchObject({ symbol: { name: 'plus.circle' } })
  })

  it('shows the directory and both stat colours after the name', () => {
    const items = flowEntryItems(groups)
    const trailing = items[1]?.kind === 'file' ? (items[1].trailing ?? []) : []
    expect(trailing.map((span) => span.text)).toEqual(['apps/web/src', '+40', '−4'])
    expect(trailing[1]?.tint).not.toBe(trailing[2]?.tint)
  })

  it('drops the directory column for a file at the repo root', () => {
    const items = flowEntryItems(groups)
    const trailing = items[4]?.kind === 'file' ? (items[4].trailing ?? []) : []
    expect(trailing.map((span) => span.text)).toEqual(['+3', '−9'])
  })

  it('ticks a reviewed file and says so out loud', () => {
    const items = flowEntryItems(groups, ['read-dir.ts'])
    const reviewed = items[4]
    expect(reviewed?.kind === 'file' ? reviewed.trailing?.at(-1) : undefined).toMatchObject({
      text: '✓',
    })
    expect(reviewed?.kind === 'file' ? reviewed.label : '').toContain('reviewed')
    const unreviewed = items[1]
    expect(unreviewed?.kind === 'file' ? unreviewed.label : '').not.toContain('reviewed')
  })
})
