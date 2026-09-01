import {
  type AddReviewCommentInput,
  type ClearResolvedReviewCommentsInput,
  type DeleteReviewCommentInput,
  type EditReviewCommentInput,
  type ResolveReviewCommentInput,
  reviewProcedures,
} from '@porcelain/contracts/review'
import { type ReviewCommentsQuery, reviewCommentsQuery } from './comment-queries'

/**
 * Review-comment mutation consequence definitions.
 *
 * Each entry binds exactly one Review-comment procedure, the comments query identity it
 * affects via wire `repoPath`, and the authoritative-refetch requirement. Transport and
 * React stay in adapters.
 */

/** The five canonical Review-comment procedure objects. */
type ReviewCommentProcedure =
  | (typeof reviewProcedures)['addReviewComment']
  | (typeof reviewProcedures)['editReviewComment']
  | (typeof reviewProcedures)['deleteReviewComment']
  | (typeof reviewProcedures)['resolveReviewComment']
  | (typeof reviewProcedures)['clearResolvedReviewComments']

export type ReviewCommentMutationDefinition<TInput> = {
  /** Canonical Review-comment procedure contract object (not a free-form invalidation string). */
  readonly procedure: ReviewCommentProcedure
  /** Catalog key of the bound Review-comment procedure. */
  readonly procedureName:
    | 'addReviewComment'
    | 'editReviewComment'
    | 'deleteReviewComment'
    | 'resolveReviewComment'
    | 'clearResolvedReviewComments'
  readonly affectedQueries: (input: TInput) => readonly ReviewCommentsQuery[]
  readonly requiresAuthoritativeRefetch: true
}

export const reviewCommentMutations = {
  add: {
    procedure: reviewProcedures.addReviewComment,
    procedureName: 'addReviewComment',
    affectedQueries: (input: AddReviewCommentInput): readonly ReviewCommentsQuery[] => [
      reviewCommentsQuery(input.repoPath),
    ],
    requiresAuthoritativeRefetch: true,
  },
  edit: {
    procedure: reviewProcedures.editReviewComment,
    procedureName: 'editReviewComment',
    affectedQueries: (input: EditReviewCommentInput): readonly ReviewCommentsQuery[] => [
      reviewCommentsQuery(input.repoPath),
    ],
    requiresAuthoritativeRefetch: true,
  },
  delete: {
    procedure: reviewProcedures.deleteReviewComment,
    procedureName: 'deleteReviewComment',
    affectedQueries: (input: DeleteReviewCommentInput): readonly ReviewCommentsQuery[] => [
      reviewCommentsQuery(input.repoPath),
    ],
    requiresAuthoritativeRefetch: true,
  },
  setResolved: {
    procedure: reviewProcedures.resolveReviewComment,
    procedureName: 'resolveReviewComment',
    affectedQueries: (input: ResolveReviewCommentInput): readonly ReviewCommentsQuery[] => [
      reviewCommentsQuery(input.repoPath),
    ],
    requiresAuthoritativeRefetch: true,
  },
  clearResolved: {
    procedure: reviewProcedures.clearResolvedReviewComments,
    procedureName: 'clearResolvedReviewComments',
    affectedQueries: (input: ClearResolvedReviewCommentsInput): readonly ReviewCommentsQuery[] => [
      reviewCommentsQuery(input.repoPath),
    ],
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly add: ReviewCommentMutationDefinition<AddReviewCommentInput>
  readonly edit: ReviewCommentMutationDefinition<EditReviewCommentInput>
  readonly delete: ReviewCommentMutationDefinition<DeleteReviewCommentInput>
  readonly setResolved: ReviewCommentMutationDefinition<ResolveReviewCommentInput>
  readonly clearResolved: ReviewCommentMutationDefinition<ClearResolvedReviewCommentsInput>
}

export type ReviewCommentMutation =
  (typeof reviewCommentMutations)[keyof typeof reviewCommentMutations]
