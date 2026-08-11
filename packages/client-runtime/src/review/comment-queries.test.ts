import { describe, expect, it } from 'vitest'
import { reviewCommentsQuery, reviewCommentsQuerySchema } from './comment-queries'

const PATH_A = '/synthetic/repo'
const PATH_B = '/synthetic/other-repo'

describe('reviewCommentsQuery', () => {
  it('produces equal identities for the same Project path', () => {
    expect(reviewCommentsQuery(PATH_A)).toEqual(reviewCommentsQuery(PATH_A))
    expect(reviewCommentsQuery(PATH_A)).toEqual({
      domain: 'review',
      name: 'comments',
      projectPath: PATH_A,
    })
  })

  it('produces distinct identities for different Project paths', () => {
    expect(reviewCommentsQuery(PATH_A)).not.toEqual(reviewCommentsQuery(PATH_B))
    expect(reviewCommentsQuery(PATH_A).projectPath).toBe(PATH_A)
    expect(reviewCommentsQuery(PATH_B).projectPath).toBe(PATH_B)
  })
})

describe('reviewCommentsQuerySchema', () => {
  it('accepts the identity its constructor produces', () => {
    expect(reviewCommentsQuerySchema.safeParse(reviewCommentsQuery(PATH_A)).success).toBe(true)
  })

  it('rejects missing, numeric, and extra fields', () => {
    expect(
      reviewCommentsQuerySchema.safeParse({ domain: 'review', name: 'comments' }).success,
    ).toBe(false)
    expect(
      reviewCommentsQuerySchema.safeParse({ domain: 'review', name: 'comments', projectPath: 3 })
        .success,
    ).toBe(false)
    expect(
      reviewCommentsQuerySchema.safeParse({
        domain: 'review',
        name: 'comments',
        projectPath: PATH_A,
        extra: 'no',
      }).success,
    ).toBe(false)
  })

  it('rejects a foreign domain or name', () => {
    expect(
      reviewCommentsQuerySchema.safeParse({
        domain: 'board',
        name: 'comments',
        projectPath: PATH_A,
      }).success,
    ).toBe(false)
    expect(
      reviewCommentsQuerySchema.safeParse({
        domain: 'review',
        name: 'evidence',
        projectPath: PATH_A,
      }).success,
    ).toBe(false)
  })
})
