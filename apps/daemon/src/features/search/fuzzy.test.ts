import { describe, expect, it } from 'vitest'
import { directoriesOf, fuzzyScore, fuzzySearch } from './fuzzy'

const PATHS = [
  'packages/app/components/FeedbackWidgetPreview.spec.tsx',
  'packages/app/components/FeedbackWidget.tsx',
  'packages/lib/utils/format.ts',
  'src/main/index.ts',
]

describe('fuzzyScore', () => {
  it('matches subsequences', () => {
    expect(fuzzyScore('fwp', 'FeedbackWidgetPreview.tsx')).not.toBeNull()
  })

  it('rejects non-matches', () => {
    expect(fuzzyScore('xyz', 'format.ts')).toBeNull()
  })

  it('matches the end of a file name', () => {
    expect(fuzzyScore('spec.tsx', PATHS[0] ?? '')).not.toBeNull()
  })
})

describe('fuzzySearch', () => {
  it('ranks basename matches over scattered path matches', () => {
    const results = fuzzySearch('widget.spec', PATHS, 10)
    expect(results[0]?.path).toBe('packages/app/components/FeedbackWidgetPreview.spec.tsx')
  })

  it('prefers contiguous matches', () => {
    const results = fuzzySearch('format', PATHS, 10)
    expect(results[0]?.path).toBe('packages/lib/utils/format.ts')
  })

  it('respects the limit', () => {
    expect(fuzzySearch('s', PATHS, 2)).toHaveLength(2)
  })
})

describe('directoriesOf', () => {
  it('derives every ancestor directory, deduped', () => {
    expect(new Set(directoriesOf(['src/main/index.ts', 'src/renderer/app.tsx']))).toEqual(
      new Set(['src', 'src/main', 'src/renderer']),
    )
  })

  it('ignores top-level files (no ancestor directory)', () => {
    expect(directoriesOf(['README.md', '.env'])).toEqual([])
  })
})
