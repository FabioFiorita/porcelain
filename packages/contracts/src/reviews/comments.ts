import { z } from 'zod';
import { worktreeIdSchema } from '../projects/worktree-id.ts';

const filePath = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (value) =>
      !value.includes('\\') &&
      !value.includes('\0') &&
      !/^[a-z]:/i.test(value) &&
      value
        .split('/')
        .every(
          (part) =>
            part !== '' &&
            part !== '.' &&
            part !== '..' &&
            part.toLowerCase() !== '.git',
        ),
    'Expected a normalized relative file path',
  );
const comparison = z.discriminatedUnion('kind', [
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
  comparison: comparison.optional(),
  revision: z.string().min(1).max(256).optional(),
  contentFingerprint: z.string().min(1).max(256).optional(),
};
export const commentAuthorSchema = z.enum(['reviewer', 'agent']);
const commentTimestampSchema = z.string().datetime().optional();
export const commentAnchorSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('file'), filePath, ...evidence }),
    z
      .strictObject({
        kind: z.literal('codeRange'),
        filePath,
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
const body = z
  .string()
  .min(1)
  .max(16000)
  .refine((value) => value.trim().length > 0 && !value.includes('\0'));
export const createCommentThreadSchema = z.strictObject({
  threadId: z.uuid().optional(),
  messageId: z.uuid().optional(),
  anchor: commentAnchorSchema,
  body,
});
export const replyToCommentSchema = z.strictObject({
  messageId: z.uuid().optional(),
  body,
});
export const resolveCommentSchema = z.strictObject({ resolved: z.boolean() });
export const commentScopeSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
});
export const commentThreadScopeSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
  threadId: z.uuid(),
});
const message = z.strictObject({
  id: z.uuid(),
  body,
  author: commentAuthorSchema,
  createdAt: commentTimestampSchema,
});
export const commentThreadSchema = z.strictObject({
  id: z.uuid(),
  worktreeId: worktreeIdSchema,
  anchor: commentAnchorSchema,
  resolved: z.boolean(),
  messages: z.array(message).min(1),
  revision: z.number().int().nonnegative(),
});
export const commentThreadsSchema = z.array(commentThreadSchema);

export type CommentAuthor = z.infer<typeof commentAuthorSchema>;
export type CommentAnchor = z.infer<typeof commentAnchorSchema>;
export type CommentMessage = z.infer<typeof message>;
export type CommentThread = z.infer<typeof commentThreadSchema>;

export const seenCommentsRequestSchema = z.strictObject({
  throughRevision: z.number().int().nonnegative(),
});
export const seenCommentsResponseSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
  seenThrough: z.number().int().nonnegative(),
});
