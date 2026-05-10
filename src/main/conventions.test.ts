import { describe, expect, it } from 'vitest'
import { parseConventions } from './conventions'

describe('parseConventions', () => {
  it('ranks used types first by frequency and appends unused defaults', () => {
    const subjects = ['wip: try things', 'wip: more', 'feat(dtc): add screen', 'fix: typo']
    const { types } = parseConventions(subjects)
    expect(types.slice(0, 3)).toEqual(['wip', 'feat', 'fix'])
    expect(types).toContain('chore')
    expect(types).toContain('refactor')
  })

  it('collects scopes by frequency', () => {
    const subjects = [
      'feat(dtc): a',
      'fix(dtc): b',
      'feat(api): c',
      'feat!: breaking without scope',
      'no convention here',
    ]
    expect(parseConventions(subjects).scopes).toEqual(['dtc', 'api'])
  })

  it('ignores non-conventional subjects', () => {
    const { types, scopes } = parseConventions(['Merge branch main', 'Update README'])
    expect(types).toEqual(['feat', 'fix', 'chore', 'refactor', 'docs', 'test'])
    expect(scopes).toEqual([])
  })
})
