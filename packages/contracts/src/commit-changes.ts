import { z } from 'zod';
import { commitOidSchema } from './commit-history.ts';

export const commitChangesParamsSchema = z.strictObject({
  worktreeId: z.uuid(),
  oid: commitOidSchema,
});
export const commitChangesQuerySchema = z.strictObject({
  parent: z.coerce.number().int().min(1).max(1000).optional(),
});
export const commitChangesResponseSchema = z.object({
  commitOid: commitOidSchema,
  parentOids: z.array(commitOidSchema),
  comparison: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('parent'),
      parentNumber: z.number().int().positive(),
      baseOid: commitOidSchema,
    }),
    z.object({ kind: z.literal('empty-tree') }),
  ]),
  changes: z
    .array(
      z.object({
        oldPath: z.string().nullable(),
        newPath: z.string().nullable(),
        status: z.enum([
          'added',
          'deleted',
          'modified',
          'renamed',
          'type-changed',
        ]),
        oldMode: z.string(),
        newMode: z.string(),
        patch: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('text'), text: z.string() }),
          z.object({ kind: z.literal('binary') }),
          z.object({ kind: z.literal('submodule'), text: z.string() }),
        ]),
      }),
    )
    .max(500),
});
export type CommitChangesResponse = z.infer<typeof commitChangesResponseSchema>;
