import { z } from 'zod';
import { oidListSchema, oidSchema } from '../shared/oid.ts';

export const listCommitsQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  after: oidListSchema.optional(),
  tip: oidSchema.optional(),
});

const commitHeadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attached'), ref: z.string() }),
  z.object({ kind: z.literal('detached') }),
  z.object({ kind: z.literal('unborn'), ref: z.string() }),
]);

export const commitSummarySchema = z.object({
  oid: oidSchema,
  parentOids: z.array(oidSchema),
  author: z.object({ name: z.string(), timestamp: z.string() }),
  subject: z.string(),
  subjectTruncated: z.boolean(),
  body: z.string().nullable(),
  bodyTruncated: z.boolean(),
  refs: z.array(z.string()),
});

export const listCommitsResponseSchema = z.object({
  snapshot: z
    .object({ tipOid: oidSchema.nullable(), head: commitHeadSchema })
    .nullable(),
  commits: z.array(commitSummarySchema).max(100),
  nextAfter: z.array(oidSchema).max(100).nullable(),
  tip: oidSchema.nullable(),
  boundary: z.enum(['shallow', 'wide']).nullable(),
  restarted: z.boolean(),
});

export type ListCommitsQuery = z.output<typeof listCommitsQuerySchema>;
export type CommitSummary = z.output<typeof commitSummarySchema>;
export type ListCommitsResponse = z.output<typeof listCommitsResponseSchema>;
