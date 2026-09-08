import { z } from 'zod';

const filePath = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (value) =>
      !value.includes('\\') &&
      !value.includes('\0') &&
      !value.includes(':') &&
      value
        .split('/')
        .every((part) => part !== '' && part !== '.' && part !== '..'),
    'Expected a normalized relative file path',
  );
const evidence = {
  revision: z.string().min(1).max(256).optional(),
  contentFingerprint: z.string().min(1).max(256).optional(),
};
export const commentAnchorSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('file'), filePath, ...evidence }),
  z
    .strictObject({
      kind: z.literal('codeRange'),
      filePath,
      startLine: z.number().int().min(1).max(2147483647),
      endLine: z.number().int().min(1).max(2147483647),
      ...evidence,
    })
    .refine((value) => value.endLine >= value.startLine),
]);
const body = z
  .string()
  .min(1)
  .max(16000)
  .refine((value) => value.trim().length > 0 && !value.includes('\0'));
export const createCommentThreadSchema = z.strictObject({
  anchor: commentAnchorSchema,
  body,
});
export const replyToCommentSchema = z.strictObject({ body });
export const resolveCommentSchema = z.strictObject({ resolved: z.boolean() });
export const commentScopeSchema = z.strictObject({ worktreeId: z.uuid() });
export const commentThreadScopeSchema = z.strictObject({
  worktreeId: z.uuid(),
  threadId: z.uuid(),
});
const message = z.strictObject({ id: z.uuid(), body });
export const commentThreadSchema = z.strictObject({
  id: z.uuid(),
  worktreeId: z.uuid(),
  anchor: commentAnchorSchema,
  resolved: z.boolean(),
  messages: z.array(message).min(1),
});
export const commentThreadsSchema = z.array(commentThreadSchema);
