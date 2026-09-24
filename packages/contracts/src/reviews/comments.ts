import { z } from 'zod';
import {
  COMMENT_BODY_LENGTH,
  COMMIT_PARENTS,
  EVIDENCE_TOKEN_LENGTH,
  LINE_NUMBER_MAX,
} from '../shared/limits.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

const comparisonSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('worktree'),
    scope: z.enum(['staged', 'unstaged', 'untracked']),
  }),
  z.strictObject({ kind: z.literal('file') }),
  z.strictObject({
    kind: z.literal('commit'),
    parent: z.number().int().min(1).max(COMMIT_PARENTS),
  }),
]);
const evidence = {
  comparison: comparisonSchema.optional(),
  revision: z.string().min(1).max(EVIDENCE_TOKEN_LENGTH).optional(),
  contentFingerprint: z.string().min(1).max(EVIDENCE_TOKEN_LENGTH).optional(),
};
const bodySchema = z
  .string()
  .min(1)
  .max(COMMENT_BODY_LENGTH)
  .refine((value) => value.trim().length > 0 && !value.includes('\0'));

const commentAuthorSchema = z.enum(['reviewer', 'agent']);

const commentAnchorSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('file'),
    filePath: relativePathSchema,
    ...evidence,
  }),
  z.strictObject({
    kind: z.literal('codeRange'),
    filePath: relativePathSchema,
    startLine: z.number().int().min(1).max(LINE_NUMBER_MAX),
    endLine: z.number().int().min(1).max(LINE_NUMBER_MAX),
    side: z.enum(['additions', 'deletions']).optional(),
    ...evidence,
  }),
]);

const commentMessageSchema = z.object({
  id: z.uuid(),
  body: bodySchema,
  author: commentAuthorSchema,
  createdAt: z.iso.datetime().optional(),
});

const commentThreadSchema = z.object({
  id: z.uuid(),
  worktreeId: worktreeIdSchema,
  anchor: commentAnchorSchema,
  resolved: z.boolean(),
  messages: z.array(commentMessageSchema).min(1),
  revision: z.number().int().nonnegative(),
});

export const commentThreadParamsSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
  threadId: z.uuid(),
});

export const commentThreadScopeSchema = z.enum(['waiting', 'all']);
export const listCommentThreadsQuerySchema = z.strictObject({
  scope: commentThreadScopeSchema.optional(),
});
export const commentWriterSchema = z.object({
  kind: z.enum(['owner', 'device', 'agent']),
});
export const listCommentThreadsResponseSchema = z.array(commentThreadSchema);

export const createCommentThreadRequestSchema = z.strictObject({
  threadId: z.uuid().optional(),
  messageId: z.uuid().optional(),
  anchor: commentAnchorSchema,
  body: bodySchema,
});
export const createCommentThreadResponseSchema = commentThreadSchema;

export const replyToCommentRequestSchema = z.strictObject({
  messageId: z.uuid().optional(),
  body: bodySchema,
});
export const replyToCommentResponseSchema = commentThreadSchema;

export const updateCommentThreadRequestSchema = z.strictObject({
  resolved: z.boolean(),
});
export const updateCommentThreadResponseSchema = commentThreadSchema;

export const markCommentsSeenRequestSchema = z.strictObject({
  throughRevision: z.number().int().nonnegative(),
});
export const markCommentsSeenResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  seenThrough: z.number().int().nonnegative(),
});

export type CommentThreadParams = z.output<typeof commentThreadParamsSchema>;
export type CommentThreadScope = z.output<typeof commentThreadScopeSchema>;
export type ListCommentThreadsQuery = z.output<
  typeof listCommentThreadsQuerySchema
>;
export type CommentWriter = z.output<typeof commentWriterSchema>;
export type CommentAuthor = { writer: CommentWriter };
export type ListCommentThreadsResponse = z.output<
  typeof listCommentThreadsResponseSchema
>;
export type CreateCommentThreadRequest = z.output<
  typeof createCommentThreadRequestSchema
>;
export type CreateCommentThreadResponse = z.output<
  typeof createCommentThreadResponseSchema
>;
export type ReplyToCommentRequest = z.output<
  typeof replyToCommentRequestSchema
>;
export type ReplyToCommentResponse = z.output<
  typeof replyToCommentResponseSchema
>;
export type UpdateCommentThreadRequest = z.output<
  typeof updateCommentThreadRequestSchema
>;
export type UpdateCommentThreadResponse = z.output<
  typeof updateCommentThreadResponseSchema
>;
export type MarkCommentsSeenRequest = z.output<
  typeof markCommentsSeenRequestSchema
>;
export type MarkCommentsSeenResponse = z.output<
  typeof markCommentsSeenResponseSchema
>;
