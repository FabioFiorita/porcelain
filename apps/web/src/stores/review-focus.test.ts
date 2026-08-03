import { beforeEach, describe, expect, it } from 'vitest'
import { jumpTargets, nextTarget, type ReviewJumpTarget, useReviewFocusStore } from './review-focus'

describe('useReviewFocusStore', () => {
  beforeEach(() => {
    useReviewFocusStore.setState({
      canvasTab: 'intent',
      activeSection: null,
      visiblePath: null,
      jump: null,
    })
  })

  it('publishes the visible chapter + file', () => {
    useReviewFocusStore.getState().setVisible(2, 'src/a.ts')
    expect(useReviewFocusStore.getState().activeSection).toBe(2)
    expect(useReviewFocusStore.getState().visiblePath).toBe('src/a.ts')
  })

  it('does not notify subscribers when the visible position is unchanged', () => {
    useReviewFocusStore.getState().setVisible(1, 'src/a.ts')
    let notifications = 0
    const unsubscribe = useReviewFocusStore.subscribe(() => {
      notifications++
    })
    useReviewFocusStore.getState().setVisible(1, 'src/a.ts') // same → no notify
    expect(notifications).toBe(0)
    useReviewFocusStore.getState().setVisible(1, 'src/b.ts') // changed → notify
    expect(notifications).toBe(1)
    unsubscribe()
  })

  it('bumps the jump nonce on every request so a repeated jump re-fires', () => {
    const { requestJump } = useReviewFocusStore.getState()
    requestJump({ kind: 'section', index: 0 })
    const first = useReviewFocusStore.getState().jump
    requestJump({ kind: 'section', index: 0 })
    const second = useReviewFocusStore.getState().jump
    expect(first?.nonce).toBe(1)
    expect(second?.nonce).toBe(2)
    useReviewFocusStore.getState().clearJump()
    expect(useReviewFocusStore.getState().jump).toBeNull()
  })

  it('shares canvasTab between sidebar and viewer', () => {
    useReviewFocusStore.getState().setCanvasTab('execution')
    expect(useReviewFocusStore.getState().canvasTab).toBe('execution')
  })
})

describe('jumpTargets', () => {
  it('walks Intent sections and More files (evidence is its own canvas tab)', () => {
    expect(jumpTargets({ sectionCount: 2, hasMoreFiles: true, hasEvidence: true })).toEqual<
      ReviewJumpTarget[]
    >([
      { kind: 'section', index: 0 },
      { kind: 'section', index: 1 },
      { kind: 'section', index: 2 }, // the synthetic "More files" chapter
    ])
  })

  it('has no More files stop in a section-less document (no headers to stop at)', () => {
    expect(jumpTargets({ sectionCount: 0, hasMoreFiles: true, hasEvidence: true })).toEqual([])
    expect(jumpTargets({ sectionCount: 0, hasMoreFiles: true, hasEvidence: false })).toEqual([])
  })
})

describe('nextTarget', () => {
  const targets = jumpTargets({ sectionCount: 2, hasMoreFiles: false, hasEvidence: true })

  it('J from the top goes to the first section', () => {
    expect(nextTarget(targets, null, 1)).toEqual({ kind: 'section', index: 0 })
  })

  it('J walks forward and stops at the last Intent chapter', () => {
    expect(nextTarget(targets, 0, 1)).toEqual({ kind: 'section', index: 1 })
    expect(nextTarget(targets, 1, 1)).toBeNull()
  })

  it('K walks backward and returns to the top from the first section', () => {
    expect(nextTarget(targets, 1, -1)).toEqual({ kind: 'section', index: 0 })
    expect(nextTarget(targets, 0, -1)).toEqual({ kind: 'top' })
    expect(nextTarget(targets, null, -1)).toBeNull()
  })

  it('is a no-op on an empty document', () => {
    expect(nextTarget([], null, 1)).toBeNull()
  })
})
