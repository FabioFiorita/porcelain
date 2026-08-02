import { describe, expect, it } from 'vitest'

import { CHANGES_INVALIDATIONS } from './invalidation'

describe('Changes mutation invalidations', () => {
  it('refreshes the open working file after a commit', () => {
    expect(CHANGES_INVALIDATIONS.commit).toContain('gitDiffFile')
  })

  it('refreshes the flow and file diff after discarding a file', () => {
    expect(CHANGES_INVALIDATIONS.discard).toEqual(['gitFlow', 'gitDiffFile', 'diffReading'])
  })
})
