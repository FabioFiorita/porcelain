import { describe, expect, it } from 'vitest'
import {
  REVIEW_CHANGE_KINDS,
  reviewChangeSchema,
  reviewNotificationFixtures,
} from './review.notifications'

describe('Review change notifications', () => {
  it('covers exactly the declared change categories', () => {
    expect(reviewChangeSchema.options.map((option) => option.shape.kind.value)).toEqual([
      ...REVIEW_CHANGE_KINDS,
    ])
    expect(Object.keys(reviewNotificationFixtures)).toEqual([...REVIEW_CHANGE_KINDS])
  })

  it('accepts the review.changed fixture', () => {
    expect(reviewChangeSchema.parse(reviewNotificationFixtures['review.changed'])).toEqual(
      reviewNotificationFixtures['review.changed'],
    )
  })

  it('rejects review.changed without projectPath', () => {
    const { projectPath: _dropped, ...withoutProject } =
      reviewNotificationFixtures['review.changed']
    expect(reviewChangeSchema.safeParse(withoutProject).success).toBe(false)
  })

  it('rejects review.changed with an empty projectPath', () => {
    expect(
      reviewChangeSchema.safeParse({
        ...reviewNotificationFixtures['review.changed'],
        projectPath: '',
      }).success,
    ).toBe(false)
  })

  it('rejects review.changed carrying an unknown field', () => {
    expect(
      reviewChangeSchema.safeParse({
        ...reviewNotificationFixtures['review.changed'],
        payload: 'entity',
      }).success,
    ).toBe(false)
  })

  it('rejects a generic changed kind', () => {
    expect(
      reviewChangeSchema.safeParse({ kind: 'changed', projectPath: '/synthetic/repo' }).success,
    ).toBe(false)
  })
})
