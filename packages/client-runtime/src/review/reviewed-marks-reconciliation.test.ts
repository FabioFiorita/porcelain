import { reviewContractFixtures } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import {
  applyReviewedMarksTransition,
  rollbackReviewedMarksTransition,
} from './reviewed-marks-reconciliation'

const fixtures = reviewContractFixtures
const MARKED = fixtures.markReviewed.input.path
const OTHER_PATH = 'src/context.ts'

describe('applyReviewedMarksTransition', () => {
  it('marks a path once, idempotently, preserving first-seen order', () => {
    expect(
      applyReviewedMarksTransition('markReviewed', [OTHER_PATH], fixtures.markReviewed.input),
    ).toEqual([OTHER_PATH, MARKED])
    expect(
      applyReviewedMarksTransition(
        'markReviewed',
        [OTHER_PATH, MARKED],
        fixtures.markReviewed.input,
      ),
    ).toEqual([OTHER_PATH, MARKED])
  })

  it('unmarks only the named path', () => {
    expect(
      applyReviewedMarksTransition(
        'unmarkReviewed',
        [OTHER_PATH, MARKED],
        fixtures.unmarkReviewed.input,
      ),
    ).toEqual([OTHER_PATH])
    expect(
      applyReviewedMarksTransition('unmarkReviewed', [OTHER_PATH], fixtures.unmarkReviewed.input),
    ).toEqual([OTHER_PATH])
  })

  it('replaces the whole list when setting', () => {
    expect(
      applyReviewedMarksTransition('setReviewed', ['src/stale.ts'], fixtures.setReviewed.input),
    ).toEqual(fixtures.setReviewed.input.paths)
  })

  it('treats an absent previous list as empty', () => {
    expect(
      applyReviewedMarksTransition('markReviewed', undefined, fixtures.markReviewed.input),
    ).toEqual([MARKED])
    expect(
      applyReviewedMarksTransition('unmarkReviewed', undefined, fixtures.unmarkReviewed.input),
    ).toEqual([])
    expect(
      applyReviewedMarksTransition('setReviewed', undefined, fixtures.setReviewed.input),
    ).toEqual(fixtures.setReviewed.input.paths)
  })

  it('never mutates its input arrays', () => {
    const previous = [OTHER_PATH]
    applyReviewedMarksTransition('markReviewed', previous, fixtures.markReviewed.input)
    applyReviewedMarksTransition('unmarkReviewed', previous, fixtures.unmarkReviewed.input)
    const set = applyReviewedMarksTransition('setReviewed', previous, fixtures.setReviewed.input)
    expect(previous).toEqual([OTHER_PATH])
    expect(set).not.toBe(fixtures.setReviewed.input.paths)
  })
})

describe('rollbackReviewedMarksTransition', () => {
  it('restores the exact snapshot', () => {
    const snapshot = { paths: [OTHER_PATH, MARKED] }
    expect(rollbackReviewedMarksTransition(snapshot)).toEqual([OTHER_PATH, MARKED])
    expect(rollbackReviewedMarksTransition({ paths: [] })).toEqual([])
  })
})
