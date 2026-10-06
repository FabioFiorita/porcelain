import { Schema } from 'effect';

import { Tool, Toolkit } from 'effect/ai';

import { apiErrorSchema } from '../shared/api-error.ts';

import {
  createCommentThreadResponseSchema,
  listCommentThreadsResponseSchema,
  replyToCommentResponseSchema,
  updateCommentThreadResponseSchema,
} from './comments.ts';

import { readPublishedReviewResponseSchema } from './review.ts';

import {
  createCommentToolRequestSchema,
  listCommentsToolRequestSchema,
  publishReviewToolRequestSchema,
  publishReviewToolResponseSchema,
  readReviewToolRequestSchema,
  replyToCommentToolRequestSchema,
  resolveCommentToolRequestSchema,
} from './review-tools.ts';

const publish_review = Tool.make('publish_review', {
  parameters: publishReviewToolRequestSchema,
  success: publishReviewToolResponseSchema,
  failure: apiErrorSchema,
  failureMode: 'return',
  description:
    'Atomically replace the latest summary, diagram, review layers and proof. Read the current revision and porcelain://review-guide first. Include your own CSS, matching the reviewed application where possible; missing CSS produces an advisory warning. Attach proof that the work is done: checks you ran with their result, and screenshots, short videos or links.',
})
  .annotate(Tool.Strict, true)
  .annotate(Tool.OpenWorld, false)
  .annotate(Tool.Destructive, true);

const read_review = Tool.make('read_review', {
  parameters: readReviewToolRequestSchema,
  success: readPublishedReviewResponseSchema,
  failure: apiErrorSchema,
  failureMode: 'return',
  description:
    'Read the latest published review, resolved pointers and uncovered changed lines.',
})
  .annotate(Tool.Strict, true)
  .annotate(Tool.OpenWorld, false)
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true);

const list_comments = Tool.make('list_comments', {
  parameters: listCommentsToolRequestSchema,
  success: Schema.Struct({ threads: listCommentThreadsResponseSchema }),
  failure: apiErrorSchema,
  failureMode: 'return',
  description:
    'Read review threads waiting for the agent. Omit scope, or pass waiting, for unresolved threads whose latest message is not from the agent. Pass all to include every thread.',
})
  .annotate(Tool.Strict, true)
  .annotate(Tool.OpenWorld, false)
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true);

const create_comment = Tool.make('create_comment', {
  parameters: createCommentToolRequestSchema,
  success: createCommentThreadResponseSchema,
  failure: apiErrorSchema,
  failureMode: 'return',
  description:
    'Create an agent review thread on the whole change (kind change, with a branch comparison and its tip for a branch review), a file or a code range. Stable optional IDs make retries idempotent.',
})
  .annotate(Tool.Strict, true)
  .annotate(Tool.OpenWorld, false)
  .annotate(Tool.Destructive, false);

const reply_to_comment = Tool.make('reply_to_comment', {
  parameters: replyToCommentToolRequestSchema,
  success: replyToCommentResponseSchema,
  failure: apiErrorSchema,
  failureMode: 'return',
  description:
    'Reply to a review thread. Stable optional messageId makes retries idempotent.',
})
  .annotate(Tool.Strict, true)
  .annotate(Tool.OpenWorld, false)
  .annotate(Tool.Destructive, false);

const resolve_comment = Tool.make('resolve_comment', {
  parameters: resolveCommentToolRequestSchema,
  success: updateCommentThreadResponseSchema,
  failure: apiErrorSchema,
  failureMode: 'return',
  description: 'Resolve or reopen a review thread.',
})
  .annotate(Tool.Strict, true)
  .annotate(Tool.OpenWorld, false)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

export const ReviewToolkit = Toolkit.make(
  publish_review,
  read_review,
  list_comments,
  create_comment,
  reply_to_comment,
  resolve_comment,
);
