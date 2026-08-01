import { describe, expect, it } from 'vitest'

import { pendingTokenRowIds } from './token-window'

const rows = Array.from({ length: 100 }, (_unused, index) => ({ id: `row-${index}` }))
const all = new Set(rows.map((row) => row.id))

describe('pendingTokenRowIds', () => {
  it('overscans around the viewport and clamps to the document', () => {
    const pending = pendingTokenRowIds({
      overscan: 5,
      rows,
      tokenizable: all,
      tokenized: new Set(),
      visible: { firstIndex: 0, lastIndex: 2 },
    })
    expect(pending).toEqual(rows.slice(0, 8).map((row) => row.id))
  })

  it('never asks twice for a row already patched', () => {
    const pending = pendingTokenRowIds({
      overscan: 1,
      rows,
      tokenizable: all,
      tokenized: new Set(['row-10', 'row-11']),
      visible: { firstIndex: 10, lastIndex: 12 },
    })
    expect(pending).toEqual(['row-9', 'row-12', 'row-13'])
  })

  it('skips rows that carry no syntax', () => {
    const pending = pendingTokenRowIds({
      overscan: 0,
      rows,
      tokenizable: new Set(['row-6']),
      tokenized: new Set(),
      visible: { firstIndex: 5, lastIndex: 7 },
    })
    expect(pending).toEqual(['row-6'])
  })

  it('caps one pass so a long window cannot own the frame', () => {
    const pending = pendingTokenRowIds({
      batch: 4,
      overscan: 50,
      rows,
      tokenizable: all,
      tokenized: new Set(),
      visible: { firstIndex: 40, lastIndex: 60 },
    })
    expect(pending).toHaveLength(4)
  })
})
