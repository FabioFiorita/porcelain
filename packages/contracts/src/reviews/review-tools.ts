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

const reviewToolScopeSchema = z.strictObject({
  cwd: z.string().min(1).max(4096).optional(),
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
