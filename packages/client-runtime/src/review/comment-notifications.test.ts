import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import {
  reviewChangedSchema,
  reviewChangeSchema,
  reviewContractFixtures,
  reviewNotificationFixtures,
  reviewProcedures,
} from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import { reviewCommentNotificationEffects } from './comment-notifications'
import { reviewCommentsQuery } from './comment-queries'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other-repo'

const reviewCatalog = {
  procedures: {
    reviewComments: reviewProcedures.reviewComments,
  },
  notification: reviewChangeSchema,
  publicError: publicErrorSchema,
}

describe('reviewCommentNotificationEffects', () => {
  it('maps a valid review.changed fixture to one comments identity for its Project', () => {
    const notification = reviewNotificationFixtures['review.changed']
    expect(reviewCommentNotificationEffects(notification)).toEqual([
      reviewCommentsQuery(notification.projectPath),
    ])
    expect(reviewCommentNotificationEffects(notification)).not.toEqual([reviewCommentsQuery(OTHER)])
  })

  it('maps a parsed review.changed value to the comments identity for that path', () => {
    const notification = reviewChangedSchema.parse({
      kind: 'review.changed',
      projectPath: PROJECT,
    })
    expect(reviewCommentNotificationEffects(notification)).toEqual([reviewCommentsQuery(PROJECT)])
  })

  it('rejects malformed and unrelated notifications via the contract mock', () => {
    const daemon = createValidatingDaemonMock(reviewCatalog, {
      reviewComments: () => ({
        ok: true,
        value: reviewContractFixtures.reviewComments.output,
      }),
    })

    const seen: unknown[] = []
    daemon.subscribe((notification) => {
      seen.push(reviewCommentNotificationEffects(reviewChangeSchema.parse(notification)))
    })

    const valid = reviewNotificationFixtures['review.changed']
    expect(daemon.emit(valid)).toEqual(valid)
    expect(seen).toEqual([[reviewCommentsQuery(PROJECT)]])

    // Missing projectPath
    expect(() => daemon.emit({ kind: 'review.changed' })).toThrow()
    // Empty projectPath
    expect(() => daemon.emit({ kind: 'review.changed', projectPath: '' })).toThrow()
    // Unknown field
    expect(() =>
      daemon.emit({ kind: 'review.changed', projectPath: PROJECT, payload: true }),
    ).toThrow()
    // Unrelated kind
    expect(() => daemon.emit({ kind: 'files.tree-changed', projectPath: PROJECT })).toThrow()
    // Raw legacy comments event envelope
    expect(() => daemon.emit({ type: 'comments' })).toThrow()
    // Raw legacy board event envelope
    expect(() => daemon.emit({ type: 'board' })).toThrow()

    expect(seen).toHaveLength(1)
  })
})
