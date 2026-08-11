import { describe, expect, it } from 'vitest'
import { reviewCommentsQuery } from './comment-queries'

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
