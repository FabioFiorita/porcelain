import { Effect, Schema } from 'effect';
import {
  commentThreadScopeSchema,
  commentThreadTargetParamsSchema,
  createCommentThreadRequestSchema,
  replyToCommentRequestSchema,
  updateCommentThreadRequestSchema,
} from './comments.ts';
import {
  publishReviewRequestSchema,
  readReviewQuerySchema,
  publishReviewResponseSchema,
} from './review.ts';
import { PATH_LENGTH } from '../shared/limits.ts';

const reviewToolScopeSchema = Schema.Struct({
  cwd: Schema.optionalKey(
    Schema.String.check(Schema.isMinLength(1)).check(
      Schema.isMaxLength(PATH_LENGTH),
    ),
  ),
});

export const publishReviewToolRequestSchema = Schema.Struct({
  ...reviewToolScopeSchema.fields,
  ...publishReviewRequestSchema.fields,
});
export const publishReviewToolResponseSchema = Schema.Struct({
  ...publishReviewResponseSchema.fields,
  ...{
    warnings: Schema.Array(Schema.String),
  },
});
export const readReviewToolRequestSchema = Schema.Struct({
  ...reviewToolScopeSchema.fields,
  reviewId: Schema.optional(Schema.String.check(Schema.isUUID())),
  ...readReviewQuerySchema.fields,
});
export const listCommentsToolRequestSchema = Schema.Struct({
  reviewId: Schema.optional(Schema.String.check(Schema.isUUID())),
  ...reviewToolScopeSchema.fields,
  ...{
    scope: commentThreadScopeSchema.pipe(
      Schema.withDecodingDefaultKey(Effect.succeed('waiting')),
    ),
  },
});
export const createCommentToolRequestSchema = Schema.Struct({
  ...reviewToolScopeSchema.fields,
  ...createCommentThreadRequestSchema.fields,
});
export const replyToCommentToolRequestSchema = Schema.Struct({
  ...reviewToolScopeSchema.fields,
  ...{
    ...commentThreadTargetParamsSchema.fields,
    ...replyToCommentRequestSchema.fields,
  },
});
export const resolveCommentToolRequestSchema = Schema.Struct({
  ...reviewToolScopeSchema.fields,
  ...{
    ...commentThreadTargetParamsSchema.fields,
    ...updateCommentThreadRequestSchema.fields,
  },
});

export type PublishReviewToolResponse =
  typeof publishReviewToolResponseSchema.Type;
