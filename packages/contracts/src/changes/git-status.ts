import { z } from 'zod';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

export const gitChangeSelectionSchema = z
  .strictObject({
    scope: z.enum(['staged', 'unstaged']),
    oldPath: relativePathSchema.nullable(),
    newPath: relativePathSchema.nullable(),
  })
  .refine((change) => change.oldPath !== null || change.newPath !== null);

export const ordinaryChangeSchema = z.object({
  scope: z.enum(['staged', 'unstaged']),
  kind: z.enum(['added', 'modified', 'deleted', 'renamed', 'type-changed']),
  oldPath: relativePathSchema.nullable(),
  newPath: relativePathSchema.nullable(),
  oldMode: z.string().regex(/^[0-7]{6}$/),
  newMode: z.string().regex(/^[0-7]{6}$/),
  oldOid: oidSchema.nullable(),
  newOid: oidSchema.nullable(),
  supported: z.boolean(),
});

export const untrackedChangeSchema = z.object({
  scope: z.literal('untracked'),
  path: relativePathSchema,
});

export const unmergedChangeSchema = z.object({
  scope: z.literal('unmerged'),
  path: relativePathSchema,
  conflict: z.enum(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']),
});

export const gitChangeSchema = z.union([
  ordinaryChangeSchema,
  untrackedChangeSchema,
  unmergedChangeSchema,
]);

export const readGitStatusResponseSchema = z.object({
  environmentId: z.uuid(),
  worktreeId: worktreeIdSchema,
  statusToken: fingerprintSchema,
  branch: z
    .object({
      name: z.string().nullable(),
      upstream: z.string().nullable(),
      ahead: z.number().int().nonnegative(),
      behind: z.number().int().nonnegative(),
      remoteName: z.string().nullable().optional(),
      sourceRef: z.string().nullable().optional(),
      upstreamOid: oidSchema.nullable().optional(),
      stashes: z
        .array(z.object({ oid: oidSchema, message: z.string() }))
        .optional(),
      discarded: z
        .array(
          z.object({
            oid: oidSchema,
            path: relativePathSchema,
            kind: z.enum(['hunk', 'rename']),
          }),
        )
        .max(50)
        .optional(),
    })
    .optional(),
  consistency: z.literal('best-effort'),
  headOid: oidSchema.nullable(),
  inProgress: z.enum(['merge', 'rebase']).nullable(),
  mergeHeadOid: oidSchema.nullable(),
  headCommit: z
    .object({ subject: z.string(), body: z.string().optional() })
    .nullable(),
  changes: z.array(gitChangeSchema).max(2000),
});

export type GitChangeSelection = z.output<typeof gitChangeSelectionSchema>;
export type OrdinaryChange = z.output<typeof ordinaryChangeSchema>;
export type UntrackedChange = z.output<typeof untrackedChangeSchema>;
export type UnmergedChange = z.output<typeof unmergedChangeSchema>;
export type GitChange = z.output<typeof gitChangeSchema>;
export type ReadGitStatusResponse = z.output<
  typeof readGitStatusResponseSchema
>;
