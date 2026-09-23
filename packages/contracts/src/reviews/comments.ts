import { z } from 'zod';
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
    parent: z.number().int().min(1).max(1000),
  }),
]);
const evidence = {
  comparison: comparisonSchema.optional(),
  revision: z.string().min(1).max(256).optional(),
  contentFingerprint: z.string().min(1).max(256).optional(),
};
const bodySchema = z
  .string()
  .min(1)
  .max(16000)
  .refine((value) => value.trim().length > 0 && !value.includes('\0'));

export const commentAuthorSchema = z.enum(['reviewer', 'agent']);

export const commentAnchorSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('file'),
      filePath: relativePathSchema,
      ...evidence,
    }),
    z
      .strictObject({
        kind: z.literal('codeRange'),
        filePath: relativePathSchema,
        startLine: z.number().int().min(1).max(2147483647),
        endLine: z.number().int().min(1).max(2147483647),
        side: z.enum(['additions', 'deletions']).optional(),
        ...evidence,
      })
      .refine((value) => value.endLine >= value.startLine),
  ])
  .refine((anchor) => {
    if (!anchor.comparison) return true;
    return anchor.comparison.kind === 'commit'
      ? /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(anchor.revision ?? '')
      : anchor.revision === undefined;
  }, 'The comparison must identify the revision it belongs to');

export const commentMessageSchema = z.object({
  id: z.uuid(),
  body: bodySchema,
  author: commentAuthorSchema,
  createdAt: z.iso.datetime().optional(),
});

export const commentThreadSchema = z.object({
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
export const listCommentThreadsResponseSchema = z.array(commentThreadSchema);
export const writtenCommentThreadSchema = z.tuple([commentThreadSchema]);

export const createCommentThreadRequestSchema = z.strictObject({
  threadId: z.uuid().optional(),
  messageId: z.uuid().optional(),
  anchor: commentAnchorSchema,
  body: bodySchema,
});
export const createCommentThreadResponseSchema = writtenCommentThreadSchema;

export const replyToCommentRequestSchema = z.strictObject({
  messageId: z.uuid().optional(),
  body: bodySchema,
});
export const replyToCommentResponseSchema = writtenCommentThreadSchema;

export const resolveCommentThreadRequestSchema = z.strictObject({
  resolved: z.boolean(),
});
export const resolveCommentThreadResponseSchema = writtenCommentThreadSchema;

export const markCommentsSeenRequestSchema = z.strictObject({
  throughRevision: z.number().int().nonnegative(),
});
export const markCommentsSeenResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  seenThrough: z.number().int().nonnegative(),
});

export type CommentAuthor = z.output<typeof commentAuthorSchema>;
export type CommentAnchor = z.output<typeof commentAnchorSchema>;
export type CommentMessage = z.output<typeof commentMessageSchema>;
export type CommentThread = z.output<typeof commentThreadSchema>;
export type CommentThreadParams = z.output<typeof commentThreadParamsSchema>;
export type CommentThreadScope = z.output<typeof commentThreadScopeSchema>;
export type ListCommentThreadsResponse = z.output<
  typeof listCommentThreadsResponseSchema
>;
export type WrittenCommentThread = z.output<typeof writtenCommentThreadSchema>;
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
export type ResolveCommentThreadRequest = z.output<
  typeof resolveCommentThreadRequestSchema
>;
export type ResolveCommentThreadResponse = z.output<
  typeof resolveCommentThreadResponseSchema
>;
export type MarkCommentsSeenRequest = z.output<
  typeof markCommentsSeenRequestSchema
>;
export type MarkCommentsSeenResponse = z.output<
  typeof markCommentsSeenResponseSchema
>;
