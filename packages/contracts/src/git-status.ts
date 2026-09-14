import { z } from 'zod';

export const gitPathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (path) =>
      !path.includes('\0') &&
      !path.startsWith('/') &&
      path
        .split('/')
        .every((part) => part !== '' && part !== '.' && part !== '..') &&
      !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        path,
      ),
  );

export const gitChangeSelectionSchema = z
  .strictObject({
    scope: z.enum(['staged', 'unstaged']),
    oldPath: gitPathSchema.nullable(),
    newPath: gitPathSchema.nullable(),
  })
  .refine((change) => change.oldPath !== null || change.newPath !== null);

export const ordinaryChangeSchema = z.object({
  scope: z.enum(['staged', 'unstaged']),
  kind: z.enum(['added', 'modified', 'deleted', 'renamed', 'type-changed']),
  oldPath: gitPathSchema.nullable(),
  newPath: gitPathSchema.nullable(),
  oldMode: z.string().regex(/^[0-7]{6}$/),
  newMode: z.string().regex(/^[0-7]{6}$/),
  supported: z.boolean(),
});

export const untrackedChangeSchema = z.object({
  scope: z.literal('untracked'),
  path: gitPathSchema,
});

export const unmergedChangeSchema = z.object({
  scope: z.literal('unmerged'),
  path: gitPathSchema,
  conflict: z.enum(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']),
});

export const gitChangeSchema = z.union([
  ordinaryChangeSchema,
  untrackedChangeSchema,
  unmergedChangeSchema,
]);

export const gitStatusResponseSchema = z.object({
  environmentId: z.uuid(),
  worktreeId: z.uuid(),
  statusToken: z.string().regex(/^[a-f0-9]{64}$/),
  branch: z
    .object({
      name: z.string().nullable(),
      upstream: z.string().nullable(),
      ahead: z.number().int().nonnegative(),
      behind: z.number().int().nonnegative(),
      remoteName: z.string().nullable().optional(),
      sourceRef: z.string().nullable().optional(),
      stashes: z
        .array(
          z.object({
            oid: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
            message: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  consistency: z.literal('best-effort'),
  headOid: z
    .string()
    .regex(/^[a-f0-9]{40,64}$/)
    .nullable(),
  changes: z.array(gitChangeSchema).max(2000),
});

export const gitWorktreeParamsSchema = z.strictObject({ worktreeId: z.uuid() });
export type GitStatusResponse = z.infer<typeof gitStatusResponseSchema>;
