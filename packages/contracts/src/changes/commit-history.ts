import { z } from 'zod';
import { oidListSchema, oidSchema } from '../shared/oid.ts';
import { absentAsNull } from './absent-as-null.ts';

const oidCursorSchema = z.codec(oidListSchema, z.array(oidSchema), {
  decode: (list) => list.split(','),
  encode: (oids) => oids.join(','),
});

export const listCommitsQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  after: oidCursorSchema.optional(),
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
  body: absentAsNull(z.string()),
  bodyTruncated: z.boolean(),
  refs: z.array(z.string()),
});

export const listCommitsResponseSchema = z.object({
  snapshot: absentAsNull(
    z.object({ tipOid: absentAsNull(oidSchema), head: commitHeadSchema }),
  ),
  commits: z.array(commitSummarySchema).max(100),
  nextAfter: absentAsNull(z.array(oidSchema).max(100)),
  tip: absentAsNull(oidSchema),
  boundary: absentAsNull(z.enum(['shallow', 'wide'])),
  restarted: z.boolean(),
});

export type ListCommitsQuery = z.output<typeof listCommitsQuerySchema>;
export type CommitSummary = z.output<typeof commitSummarySchema>;
export type ListCommitsResponse = z.output<typeof listCommitsResponseSchema>;
