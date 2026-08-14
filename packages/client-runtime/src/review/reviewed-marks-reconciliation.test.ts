import { reviewContractFixtures } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import {
  applyReviewedMarksTransition,
  rollbackReviewedMarksTransition,
} from './reviewed-marks-reconciliation'

const fixtures = reviewContractFixtures
const MARK_INPUT = fixtures.setReviewed.input
const UNMARK_INPUT = { ...MARK_INPUT, reviewed: false } as const
// Destructuring gives `string | undefined` under noUncheckedIndexedAccess. Assert the fixture
// actually carries the two paths every case below assumes, rather than propagating undefined.
const [FIRST, SECOND] = MARK_INPUT.paths
if (FIRST === undefined || SECOND === undefined) {
  throw new Error('expected setReviewed fixture to name two paths')
}
const UNRELATED = 'src/unrelated.ts'

describe('applyReviewedMarksTransition', () => {
  it('marks the named paths once, idempotently, preserving first-seen order', () => {
    expect(applyReviewedMarksTransition('setReviewed', [UNRELATED], MARK_INPUT)).toEqual([
      UNRELATED,
      FIRST,
      SECOND,
    ])
    expect(
      applyReviewedMarksTransition('setReviewed', [UNRELATED, FIRST, SECOND], MARK_INPUT),
    ).toEqual([UNRELATED, FIRST, SECOND])
  })

  it('unmarks only the named paths and leaves every other mark alone', () => {
    expect(
      applyReviewedMarksTransition('setReviewed', [UNRELATED, FIRST, SECOND], UNMARK_INPUT),
    ).toEqual([UNRELATED])
    expect(applyReviewedMarksTransition('setReviewed', [UNRELATED], UNMARK_INPUT)).toEqual([
      UNRELATED,
    ])
  })

  it('treats an absent previous list as empty', () => {
    expect(applyReviewedMarksTransition('setReviewed', undefined, MARK_INPUT)).toEqual([
      FIRST,
      SECOND,
    ])
    expect(applyReviewedMarksTransition('setReviewed', undefined, UNMARK_INPUT)).toEqual([])
  })

  it('never mutates its input arrays', () => {
    const previous = [UNRELATED]
    const marked = applyReviewedMarksTransition('setReviewed', previous, MARK_INPUT)
    applyReviewedMarksTransition('setReviewed', previous, UNMARK_INPUT)
    expect(previous).toEqual([UNRELATED])
    expect(marked).not.toBe(MARK_INPUT.paths)
  })
})

describe('rollbackReviewedMarksTransition', () => {
  it('restores the exact snapshot', () => {
    const snapshot = { paths: [UNRELATED, FIRST] }
    expect(rollbackReviewedMarksTransition(snapshot)).toEqual([UNRELATED, FIRST])
    expect(rollbackReviewedMarksTransition({ paths: [] })).toEqual([])
  })
})
