import { z } from 'zod';
import {
  commentThreadScopeSchema,
  createCommentThreadRequestSchema,
  replyToCommentRequestSchema,
  resolveCommentThreadRequestSchema,
} from './comments.ts';
import {
  publishReviewRequestSchema,
  readPublishedReviewResponseSchema,
} from './review.ts';
import { PATH_LENGTH } from '../shared/limits.ts';

const reviewToolScopeSchema = z.strictObject({
  cwd: z.string().min(1).max(PATH_LENGTH).optional(),
});

export const publishReviewToolRequestSchema = reviewToolScopeSchema.extend(
  publishReviewRequestSchema.shape,
);
export const publishReviewToolResponseSchema =
  readPublishedReviewResponseSchema.extend({
    warnings: z.array(z.string()),
  });
export const readReviewToolRequestSchema = reviewToolScopeSchema;
export const listCommentsToolRequestSchema = reviewToolScopeSchema.extend({
  scope: commentThreadScopeSchema.default('waiting'),
});
export const createCommentToolRequestSchema = reviewToolScopeSchema.extend(
  createCommentThreadRequestSchema.shape,
);
export const replyToCommentToolRequestSchema = reviewToolScopeSchema.extend({
  threadId: z.uuid(),
  ...replyToCommentRequestSchema.shape,
});
export const resolveCommentToolRequestSchema = reviewToolScopeSchema.extend({
  threadId: z.uuid(),
  ...resolveCommentThreadRequestSchema.shape,
});

export type PublishReviewToolResponse = z.output<
  typeof publishReviewToolResponseSchema
>;
