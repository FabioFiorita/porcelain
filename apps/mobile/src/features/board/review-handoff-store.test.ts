import { beforeEach, describe, expect, it } from 'vitest'

import { useReviewHandoffStore } from './review-handoff-store'

describe('useReviewHandoffStore', () => {
  beforeEach(() => {
    useReviewHandoffStore.setState({ suggestedName: null })
  })

  it('suggests a trimmed name and consumes it once', () => {
    useReviewHandoffStore.getState().suggest('  Ship the cutover  ')
    expect(useReviewHandoffStore.getState().suggestedName).toBe('Ship the cutover')
    expect(useReviewHandoffStore.getState().consume()).toBe('Ship the cutover')
    expect(useReviewHandoffStore.getState().consume()).toBeNull()
    expect(useReviewHandoffStore.getState().suggestedName).toBeNull()
  })

  it('ignores blank suggestions', () => {
    useReviewHandoffStore.getState().suggest('   ')
    expect(useReviewHandoffStore.getState().suggestedName).toBeNull()
    expect(useReviewHandoffStore.getState().consume()).toBeNull()
  })
})
