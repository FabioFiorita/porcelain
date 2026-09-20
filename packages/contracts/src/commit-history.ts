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
  /**
   * Where the walk had got to, as commit ids separated by commas: the commits
   * whose children have all been shown. Absent asks for the newest commits.
   */
  after: z
    .string()
    .regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?(?:,[0-9a-f]{40}(?:[0-9a-f]{24})?)*$/)
    .optional(),
  /** The commit the list started at, so a rewrite since can be noticed. */
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
  /** Only a page read from the top looked at HEAD; a continuation did not. */
  snapshot: z
    .object({ tipOid: commitOidSchema.nullable(), head: headSchema })
    .nullable(),
  commits: z.array(commitSummarySchema).max(100),
  /** Ask for the next page with these as `after`. Null at the end. */
  nextAfter: z.array(commitOidSchema).max(100).nullable(),
  /** The commit this list started at, to send back with every continuation. */
  tip: commitOidSchema.nullable(),
  /**
   * Why the list stops here, when it is not simply the first commit:
   * `shallow` is a clone that does not hold the rest, `wide` is a history with
   * more branches open at this point than a continuation can name.
   */
  boundary: z.enum(['shallow', 'wide']).nullable(),
  /**
   * The commit asked to continue after had left the branch, so this is the
   * history that exists now, from the top.
   */
  restarted: z.boolean(),
});
export type CommitPageResponse = z.infer<typeof commitPageResponseSchema>;
