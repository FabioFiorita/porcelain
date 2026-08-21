import type { CommitGroupResult } from '@porcelain/contracts/git'
import { describe, expect, it } from 'vitest'

import { generatedGroupsStatus, groupApplyOutcome } from './commit-groups'

function result(overrides: Partial<CommitGroupResult>): CommitGroupResult {
  return { error: null, files: ['a.ts'], message: 'feat: a', status: 'committed', ...overrides }
}

describe('groupApplyOutcome', () => {
  it('reports every group as committed and leaves nothing on screen', () => {
    const outcome = groupApplyOutcome([result({}), result({ files: ['b.ts'], message: 'fix: b' })])

    expect(outcome.status).toEqual({ failed: false, text: 'Committed 2 groups' })
    expect(outcome.remaining).toEqual([])
  })

  it('agrees in the singular', () => {
    expect(groupApplyOutcome([result({})]).status.text).toBe('Committed 1 group')
  })

  it('keeps what did not land, with git’s reason', () => {
    const outcome = groupApplyOutcome([
      result({}),
      result({
        error: 'nothing to commit',
        files: ['b.ts'],
        message: 'fix: b',
        status: 'failed',
      }),
      result({ files: ['c.ts'], message: 'docs: c', status: 'skipped' }),
    ])

    expect(outcome.status.failed).toBe(true)
    expect(outcome.status.text).toBe('Committed 1 of 3 groups — “fix: b” failed: nothing to commit')
    // The committed group is gone; the failed and skipped ones stay so the batch can be retried.
    expect(outcome.remaining).toEqual([
      { files: ['b.ts'], message: 'fix: b' },
      { files: ['c.ts'], message: 'docs: c' },
    ])
  })

  it('says so when the daemon failed a group without a reason', () => {
    const outcome = groupApplyOutcome([result({ error: null, status: 'failed' })])

    expect(outcome.status.text).toBe('Committed 0 of 1 groups — “feat: a” failed: unknown error')
  })

  it('reports an empty batch rather than throwing', () => {
    expect(groupApplyOutcome([])).toEqual({
      remaining: [],
      status: { failed: false, text: 'Committed 0 groups' },
    })
  })
})

describe('generatedGroupsStatus', () => {
  it('agrees with its count', () => {
    expect(generatedGroupsStatus(1)).toBe('Generated 1 commit group')
    expect(generatedGroupsStatus(3)).toBe('Generated 3 commit groups')
  })
})
