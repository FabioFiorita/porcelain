import { z } from 'zod';
import { worktreeIdSchema } from './worktree-id.ts';

export const commitOidSchema = z
  .string()
  .regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
export const historyParamsSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
});
export const commitPageQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  after: z
    .string()
    .regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?(?:,[0-9a-f]{40}(?:[0-9a-f]{24})?)*$/)
    .optional(),
  tip: commitOidSchema.optional(),
});
const headSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attached'), ref: z.string() }),
  z.object({ kind: z.literal('detached') }),
  z.object({ kind: z.literal('unborn'), ref: z.string() }),
]);
export const commitSummarySchema = z.object({
  oid: commitOidSchema,
  parentOids: z.array(commitOidSchema),
  author: z.object({ name: z.string(), timestamp: z.string() }),
  subject: z.string(),
  subjectTruncated: z.boolean(),
  body: z.string().nullable(),
  bodyTruncated: z.boolean(),
  refs: z.array(z.string()),
});
export const commitPageResponseSchema = z.object({
  snapshot: z
    .object({ tipOid: commitOidSchema.nullable(), head: headSchema })
    .nullable(),
  commits: z.array(commitSummarySchema).max(100),
  nextAfter: z.array(commitOidSchema).max(100).nullable(),
  tip: commitOidSchema.nullable(),
  boundary: z.enum(['shallow', 'wide']).nullable(),
  restarted: z.boolean(),
});
export type CommitPageResponse = z.infer<typeof commitPageResponseSchema>;
