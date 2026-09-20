import { z } from 'zod';
import { gitDiffContentSchema } from './git-diff.ts';
import {
  gitChangeSchema,
  gitChangeSelectionSchema,
  gitPathSchema,
  gitWorktreeParamsSchema,
} from './git-status.ts';

export const fileChangeSchema = z.strictObject({
  /** A rename uses its new path; deletions use their old path. */
  path: gitPathSchema,
  /**
   * What the reader is looking at, over every comparison of this path at once.
   * Null means at least one side could not be established, and a null
   * fingerprint can never be marked reviewed.
   */
  fingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  comparisons: z.array(gitChangeSchema).min(1),
});

export const changeListBranchSchema = z.strictObject({
  name: z.string().nullable(),
  upstream: z.string().nullable(),
  ahead: z.number().int().nonnegative(),
  behind: z.number().int().nonnegative(),
});

export const changesResponseSchema = z.strictObject({
  environmentId: z.uuid(),
  worktreeId: gitWorktreeParamsSchema.shape.worktreeId,
  /** One observation. A later diff or mark presents this to say what it saw. */
  statusToken: z.string().regex(/^[a-f0-9]{64}$/),
  headOid: z
    .string()
    .regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)
    .nullable(),
  branch: changeListBranchSchema.nullable(),
  changes: z.array(fileChangeSchema).max(2000),
});

export const changeDiffsRequestSchema = z.strictObject({
  expectedStatusToken: z.string().regex(/^[a-f0-9]{64}$/),
  /**
   * The fingerprint the caller holds for every logical path it is asking
   * about. The observation token cannot stand in for these: it hashes what
   * porcelain status prints, which does not include the bytes of a file that
   * was already modified, so editing such a file again leaves the token alone
   * while the hunks change.
   */
  expectedFiles: z
    .array(
      z.strictObject({
        path: gitPathSchema,
        fingerprint: fileChangeSchema.shape.fingerprint,
      }),
    )
    .min(1)
    .max(200),
  /** A layer's files, read in one Git process per scope. */
  selections: z.array(gitChangeSelectionSchema).min(1).max(200),
});

export const changeDiffsResponseSchema = z.strictObject({
  environmentId: z.uuid(),
  worktreeId: gitWorktreeParamsSchema.shape.worktreeId,
  statusToken: z.string().regex(/^[a-f0-9]{64}$/),
  diffs: z.array(
    z.strictObject({
      selection: gitChangeSelectionSchema,
      content: gitDiffContentSchema,
    }),
  ),
});

export const changeLinesQuerySchema = z.strictObject({
  path: gitPathSchema,
  from: z.coerce.number().int().min(1),
  to: z.coerce.number().int().min(1),
  /** `head` reads Git; the working file is never a stand-in for a revision. */
  at: z.enum(['head', 'worktree']),
});

export const changeLinesResponseSchema = z.strictObject({
  environmentId: z.uuid(),
  worktreeId: gitWorktreeParamsSchema.shape.worktreeId,
  at: z.enum(['head', 'worktree']),
  path: gitPathSchema,
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  lines: z.array(z.string()),
});

export type FileChange = z.infer<typeof fileChangeSchema>;
export type ChangesResponse = z.infer<typeof changesResponseSchema>;
export type ChangeDiffsRequest = z.infer<typeof changeDiffsRequestSchema>;
export type ChangeDiffsResponse = z.infer<typeof changeDiffsResponseSchema>;
export type ChangeLinesResponse = z.infer<typeof changeLinesResponseSchema>;
