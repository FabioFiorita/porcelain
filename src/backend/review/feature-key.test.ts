import { describe, expect, it } from 'vitest'
import type { ChangedFile, DiffStat } from './diff'
import { featureKey, flowKey } from './feature-key'
import { DEFAULT_LAYERS } from './flow'

const files: ChangedFile[] = [{ path: 'a.ts', status: 'modified', staged: false, unstaged: true }]
const stats: DiffStat[] = [{ path: 'a.ts', additions: 1, deletions: 0 }]

describe('flowKey', () => {
  it('is stable for identical inputs', () => {
    expect(flowKey(files, stats, DEFAULT_LAYERS)).toBe(flowKey(files, stats, DEFAULT_LAYERS))
  })
  it('changes when status, stats, or layers change', () => {
    const base = flowKey(files, stats, DEFAULT_LAYERS)
    expect(flowKey([], stats, DEFAULT_LAYERS)).not.toBe(base)
    expect(flowKey(files, [], DEFAULT_LAYERS)).not.toBe(base)
    expect(flowKey(files, stats, DEFAULT_LAYERS.slice(0, 1))).not.toBe(base)
  })
})

describe('featureKey', () => {
  it('changes when the review set changes (so an agent write busts the cache)', () => {
    const none = featureKey(files, stats, DEFAULT_LAYERS, null)
    const withSet = featureKey(files, stats, DEFAULT_LAYERS, {
      name: 'X',
      files: [{ path: 'b.ts' }],
      sections: [],
    })
    expect(withSet).not.toBe(none)
  })

  it('changes when only the sections change (a walkthrough edit busts the cache)', () => {
    const base = featureKey(files, stats, DEFAULT_LAYERS, {
      name: 'X',
      files: [{ path: 'b.ts' }],
      sections: [],
    })
    const withSections = featureKey(files, stats, DEFAULT_LAYERS, {
      name: 'X',
      files: [{ path: 'b.ts' }],
      sections: [{ title: 'Entry', prose: 'starts here', anchors: [{ path: 'b.ts' }] }],
    })
    expect(withSections).not.toBe(base)
  })
})
