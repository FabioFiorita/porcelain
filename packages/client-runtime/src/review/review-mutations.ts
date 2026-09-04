import {
  REVIEW_STALE_ON_REVIEW_CHANGED,
  reviewProcedures,
  type SetReviewedInput,
} from '@porcelain/contracts/review'
import { reviewCommentsQuery } from './comment-queries'
import { reviewedPathsQuery, reviewProjectKey } from './review-queries'
import type { ReviewQueryEffect } from './review-query-effects'

type ReviewMutationProcedureName = 'setReviewed'
export type ReviewMutationDefinition<TName extends ReviewMutationProcedureName, TInput> = {
  readonly procedure: (typeof reviewProcedures)[TName]
  readonly procedureName: TName
  readonly affectedQueries: (input: TInput) => readonly ReviewQueryEffect[]
  readonly optimistic: boolean
  readonly requiresAuthoritativeRefetch: true
}

const staleEffectByProcedure = {
  reviewedPaths: reviewedPathsQuery,
  reviewComments: reviewCommentsQuery,
} as const

export function reviewCanvasEffects(projectPath: string): readonly ReviewQueryEffect[] {
  const key = reviewProjectKey(projectPath)
  return REVIEW_STALE_ON_REVIEW_CHANGED.map((name) => staleEffectByProcedure[name](key))
}

export const reviewMutations = {
  setReviewed: {
    procedure: reviewProcedures.setReviewed,
    procedureName: 'setReviewed',
    affectedQueries: (input: SetReviewedInput): readonly ReviewQueryEffect[] => [
      reviewedPathsQuery(input.repoPath, input.scope),
    ],
    optimistic: true,
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly setReviewed: ReviewMutationDefinition<'setReviewed', SetReviewedInput>
}

export type ReviewMutation = (typeof reviewMutations)[keyof typeof reviewMutations]
