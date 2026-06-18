import { describe, expect, it } from 'vitest'
import { parseSuggestions } from './suggestions'

const branchHeader = (ahead: number, behind: number): string =>
  `# branch.oid abc\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +${ahead} -${behind}\n`

describe('parseSuggestions', () => {
  it('suggests nothing for a clean, synced repo', () => {
    expect(parseSuggestions(branchHeader(0, 0), '')).toEqual([])
  })

  it('suggests pull when behind upstream', () => {
    expect(parseSuggestions(branchHeader(0, 3), '')).toEqual([
      { command: 'pull', reason: 'behind upstream by 3 commits' },
    ])
  })

  it('suggests push when ahead of upstream', () => {
    expect(parseSuggestions(branchHeader(1, 0), '')).toEqual([
      { command: 'push', reason: '1 unpushed commit' },
    ])
  })

  it('suggests stash pop when stashes exist', () => {
    expect(parseSuggestions(branchHeader(0, 0), 'stash@{0}: WIP on main\n')).toEqual([
      { command: 'stash-pop', reason: '1 stash waiting' },
    ])
  })

  it('suggests stash for uncommitted changes', () => {
    const status = `${branchHeader(0, 0)}1 .M N... 100644 100644 100644 abc def src/a.ts\n? src/b.ts\n`
    expect(parseSuggestions(status, '')).toEqual([
      { command: 'stash', reason: '2 uncommitted changes' },
    ])
  })

  it('handles missing upstream (no branch.ab line)', () => {
    expect(parseSuggestions('# branch.oid abc\n# branch.head main\n', '')).toEqual([])
  })
})
