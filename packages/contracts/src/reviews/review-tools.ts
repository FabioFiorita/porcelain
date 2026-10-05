import { Effect, Schema } from 'effect';
import {
  commentThreadScopeSchema,
  createCommentThreadRequestSchema,
  replyToCommentRequestSchema,
  updateCommentThreadRequestSchema,
} from './comments.ts';
import {
  publishReviewRequestSchema,
  readPublishedReviewResponseSchema,
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
  ...readPublishedReviewResponseSchema.fields,
  ...{
    warnings: Schema.Array(Schema.String),
  },
});
export const readReviewToolRequestSchema = reviewToolScopeSchema;
export const listCommentsToolRequestSchema = Schema.Struct({
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
    threadId: Schema.String.check(Schema.isUUID()),
    ...replyToCommentRequestSchema.fields,
  },
});
export const resolveCommentToolRequestSchema = Schema.Struct({
  ...reviewToolScopeSchema.fields,
  ...{
    threadId: Schema.String.check(Schema.isUUID()),
    ...updateCommentThreadRequestSchema.fields,
  },
});

export type PublishReviewToolResponse =
  typeof publishReviewToolResponseSchema.Type;
