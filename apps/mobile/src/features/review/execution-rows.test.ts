import type { ReviewReading } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'

import { blockRowIndex, executionBlocks, executionPaths, toExecutionRows } from './execution-rows'

const changed = {
  additions: 1,
  hunks: [
    {
      header: '@@ -1 +1,2 @@',
      lines: [
        { kind: 'context' as const, newLine: 1, oldLine: 1, text: 'a' },
        { kind: 'add' as const, newLine: 2, oldLine: null, text: 'b' },
      ],
    },
  ],
  path: 'src/a.ts',
  source: 'changed' as const,
  status: 'modified' as const,
}

const context = {
  path: 'src/b.ts',
  ranges: [
    { gapBefore: 9, lines: ['export const X = 1'], startLine: 10 },
    { gapBefore: 4, lines: ['export const Y = 2', 'export const Z = 3'], startLine: 15 },
  ],
  source: 'context' as const,
}

const reading: ReviewReading = {
  evidence: null,
  groups: [{ files: [context], layer: 'Support' }],
  name: 'Unit',
  sections: [{ files: [changed], prose: 'why', title: 'Core' }],
}

describe('executionBlocks', () => {
  it('claims a file for the first block that lists it, so it is rendered once', () => {
    const both: ReviewReading = {
      ...reading,
      groups: [{ files: [changed, context], layer: 'Support' }],
    }
    const { blocks, filesByBlock } = executionBlocks(both)
    expect(blocks.map((block) => block.id)).toEqual(['section:0', 'group:Support'])
    expect(filesByBlock.get('section:0')?.map((file) => file.path)).toEqual(['src/a.ts'])
    expect(filesByBlock.get('group:Support')?.map((file) => file.path)).toEqual(['src/b.ts'])
  })

  it('drops a block whose files were all claimed earlier rather than showing an empty one', () => {
    const duplicated: ReviewReading = {
      ...reading,
      groups: [{ files: [changed], layer: 'Support' }],
    }
    expect(executionBlocks(duplicated).blocks.map((block) => block.id)).toEqual(['section:0'])
  })

  it('names an untitled section rather than captioning the block with nothing', () => {
    const untitled: ReviewReading = {
      ...reading,
      sections: [{ files: [changed], prose: '', title: '  ' }],
    }
    expect(executionBlocks(untitled).blocks[0]?.title).toBe('Walkthrough')
  })
})

describe('toExecutionRows', () => {
  it('stacks blocks, file headers and each file’s own body shape', () => {
    expect(toExecutionRows(reading, 'unified').map((row) => row.kind)).toEqual([
      'block',
      'file',
      'diff',
      'diff',
      'diff',
      'block',
      'file',
      'gap',
      'source',
      'gap',
      'source',
      'source',
    ])
  })

  it('draws the elided lines between two slices instead of closing over them', () => {
    const gaps = toExecutionRows(reading, 'unified').filter((row) => row.kind === 'gap')
    expect(gaps.map((row) => (row.kind === 'gap' ? row.lines : 0))).toEqual([9, 4])
  })

  it('numbers slice lines from their real position in the file', () => {
    const lines = toExecutionRows(reading, 'unified')
      .filter((row) => row.kind === 'source')
      .map((row) => (row.kind === 'source' ? row.row.line : 0))
    expect(lines).toEqual([10, 15, 16])
  })

  it('marks a file with no body rather than dropping it from the document', () => {
    const empty: ReviewReading = {
      ...reading,
      groups: [
        { files: [{ path: 'assets/logo.png', ranges: [], source: 'shipped' }], layer: 'Assets' },
      ],
      sections: [],
    }
    const rows = toExecutionRows(empty, 'unified')
    expect(rows.some((row) => row.kind === 'empty' && row.path === 'assets/logo.png')).toBe(true)
  })

  it('carries the agent’s note above the file body', () => {
    const noted: ReviewReading = {
      ...reading,
      groups: [],
      sections: [{ files: [{ ...changed, note: 'the point' }], prose: '', title: 'Core' }],
    }
    expect(toExecutionRows(noted, 'unified').map((row) => row.kind)).toEqual([
      'block',
      'file',
      'note',
      'diff',
      'diff',
      'diff',
    ])
  })

  it('reports a capped slice so a partial read never looks complete', () => {
    const capped: ReviewReading = {
      ...reading,
      groups: [{ files: [{ ...context, truncated: true }], layer: 'Support' }],
      sections: [],
    }
    expect(toExecutionRows(capped, 'unified').some((row) => row.kind === 'truncated')).toBe(true)
  })

  it('folds a collapsed file to its header, so the document still reads as a contents list', () => {
    const rows = toExecutionRows(reading, 'unified', new Set(['src/a.ts']))
    expect(rows.map((row) => row.kind)).toEqual([
      'block',
      'file',
      'block',
      'file',
      'gap',
      'source',
      'gap',
      'source',
      'source',
    ])
  })

  it('keys every row uniquely, which a virtualized list requires', () => {
    const rows = toExecutionRows(reading, 'unified')
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })

  it('honours the split layout for changed files', () => {
    const diff = toExecutionRows(reading, 'split').find(
      (row) => row.kind === 'diff' && row.row.kind !== 'header',
    )
    expect(diff?.kind === 'diff' && diff.row.kind).toBe('split')
  })
})

describe('blockRowIndex', () => {
  it('points at the block caption the outline asked for', () => {
    const rows = toExecutionRows(reading, 'unified')
    const index = blockRowIndex(rows, 'group:Support')
    expect(rows[index]?.kind === 'block' && rows[index]?.title).toBe('Support')
  })

  it('answers -1 for a block the current reading no longer has', () => {
    expect(blockRowIndex(toExecutionRows(reading, 'unified'), 'group:Gone')).toBe(-1)
  })
})

describe('executionPaths', () => {
  it('lists each file once, in reading order', () => {
    expect(executionPaths(reading)).toEqual(['src/a.ts', 'src/b.ts'])
  })
})
