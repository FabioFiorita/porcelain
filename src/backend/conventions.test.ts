import { describe, expect, it } from 'vitest'
import { parseConventions } from './conventions'

describe('parseConventions', () => {
  it('offers only the types the repo actually uses, by frequency', () => {
    const subjects = ['wip: try things', 'wip: more', 'feat(dtc): add screen', 'fix: typo']
    expect(parseConventions(subjects).types).toEqual(['wip', 'feat', 'fix'])
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
