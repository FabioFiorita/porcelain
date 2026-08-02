import { describe, expect, it } from 'vitest'

import { applyCommitPrefix, parseCommitPrefix } from './commit-message'

describe('commit message prefixes', () => {
  it('parses type and scope from the first line', () => {
    expect(parseCommitPrefix('feat(mobile)!: ship it\n\nbody')).toEqual({
      scope: 'mobile',
      type: 'feat',
    })
  })

  it('rewrites only the first-line prefix', () => {
    expect(applyCommitPrefix('fix: old\n\nbody', 'feat', 'mobile')).toBe(
      'feat(mobile): old\n\nbody',
    )
  })

  it('strips a prefix when the type is cleared', () => {
    expect(applyCommitPrefix('fix(api): old', null, null)).toBe('old')
  })
})
