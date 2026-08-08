import { describe, expect, it } from 'vitest'

import {
  buildPattern,
  type DraftLayer,
  deriveLabel,
  layersAreValid,
  matchingPaths,
  moveLayer,
  patternError,
  splitNames,
} from './review-layers'

const layer = (id: number, label: string, pattern: string): DraftLayer => ({ id, label, pattern })

describe('splitNames', () => {
  it('trims and drops the blanks a comma list collects', () => {
    expect(splitNames(' components , views ,, ')).toEqual(['components', 'views'])
  })

  it('is empty for an empty field', () => {
    expect(splitNames('   ')).toEqual([])
  })
})

describe('buildPattern', () => {
  it('matches a folder anywhere in the path', () => {
    const pattern = buildPattern('folder', ['components', 'views'])
    expect(pattern).toBe('(^|/)(components|views)/')
    expect(matchingPaths(pattern, ['src/components/Button.tsx', 'components/a.ts'])).toHaveLength(2)
    expect(matchingPaths(pattern, ['src/uncomponents/a.ts'])).toEqual([])
  })

  it('anchors an extension at the end', () => {
    const pattern = buildPattern('ext', ['ts', 'tsx'])
    expect(pattern).toBe('\\.(ts|tsx)$')
    expect(matchingPaths(pattern, ['a.ts', 'a.tsx', 'a.ts.map'])).toEqual(['a.ts', 'a.tsx'])
  })

  it('puts a suffix before the extension', () => {
    const pattern = buildPattern('suffix', ['test'])
    expect(pattern).toBe('\\.(test)\\.[a-z]+$')
    expect(matchingPaths(pattern, ['user.test.ts', 'user.ts'])).toEqual(['user.test.ts'])
  })

  // A project really can have a folder called `v1.2`; an unescaped dot would take `v1x2` too.
  it('escapes regex metacharacters in a name', () => {
    const pattern = buildPattern('folder', ['v1.2'])
    expect(matchingPaths(pattern, ['v1.2/a.ts', 'v1x2/a.ts'])).toEqual(['v1.2/a.ts'])
  })

  it('builds nothing from no names', () => {
    expect(buildPattern('folder', [])).toBe('')
  })
})

describe('deriveLabel', () => {
  it('title-cases the first name', () => {
    expect(deriveLabel(['components', 'views'])).toBe('Components')
  })

  it('names an unnamed layer rather than leaving it blank', () => {
    expect(deriveLabel([])).toBe('New layer')
  })
})

describe('patternError', () => {
  it('accepts a usable regex', () => {
    expect(patternError('\\.(ts)$')).toBeNull()
  })

  it('rejects an empty pattern and an uncompilable one', () => {
    expect(patternError('  ')).toBe('pattern is required')
    expect(patternError('(')).toBe('invalid regular expression')
  })
})

describe('matchingPaths', () => {
  it('returns nothing rather than throwing on a half-typed pattern', () => {
    expect(matchingPaths('(', ['a.ts'])).toEqual([])
    expect(matchingPaths('', ['a.ts'])).toEqual([])
  })
})

describe('layersAreValid', () => {
  it('requires a label and a usable pattern on every layer', () => {
    expect(layersAreValid([layer(0, 'Docs', '^docs/')])).toBe(true)
    expect(layersAreValid([layer(0, '  ', '^docs/')])).toBe(false)
    expect(layersAreValid([layer(0, 'Docs', '(')])).toBe(false)
  })

  it('holds vacuously for an empty draft', () => {
    expect(layersAreValid([])).toBe(true)
  })
})

describe('moveLayer', () => {
  const draft = [layer(0, 'A', 'a'), layer(1, 'B', 'b'), layer(2, 'C', 'c')]

  it('swaps a layer with its neighbour', () => {
    expect(moveLayer(draft, 1, -1).map((entry) => entry.label)).toEqual(['B', 'A', 'C'])
    expect(moveLayer(draft, 1, 1).map((entry) => entry.label)).toEqual(['A', 'C', 'B'])
  })

  // Order is the whole meaning of the list, so a move off the end must not wrap or drop.
  it('leaves the order alone at either end', () => {
    expect(moveLayer(draft, 0, -1).map((entry) => entry.label)).toEqual(['A', 'B', 'C'])
    expect(moveLayer(draft, 2, 1).map((entry) => entry.label)).toEqual(['A', 'B', 'C'])
  })

  it('does not mutate the draft it was given', () => {
    moveLayer(draft, 0, 1)
    expect(draft.map((entry) => entry.label)).toEqual(['A', 'B', 'C'])
  })
})
