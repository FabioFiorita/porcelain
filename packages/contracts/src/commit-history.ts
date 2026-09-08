import { z } from 'zod';

export const commitOidSchema = z
  .string()
  .regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
export const historyParamsSchema = z.strictObject({ worktreeId: z.uuid() });
export const commitPageQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(4096).optional(),
});
const headSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attached'), ref: z.string() }),
  z.object({ kind: z.literal('detached') }),
  z.object({ kind: z.literal('unborn'), ref: z.string() }),
]);
export const commitPageResponseSchema = z.object({
  snapshot: z.object({ tipOid: commitOidSchema.nullable(), head: headSchema }),
  commits: z
    .array(
      z.object({
        oid: commitOidSchema,
        parentOids: z.array(commitOidSchema),
        author: z.object({ name: z.string(), timestamp: z.string() }),
        subject: z.string(),
        subjectTruncated: z.boolean(),
      }),
    )
    .max(100),
  nextCursor: z.string().nullable(),
  boundary: z.enum(['shallow']).nullable(),
});
export type CommitPageResponse = z.infer<typeof commitPageResponseSchema>;
