import { z } from 'zod';
import { absentAsNull } from '../shared/absent-as-null.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

const conflictKinds = {
  DD: 'both-deleted',
  AU: 'added-by-us',
  UD: 'deleted-by-them',
  UA: 'added-by-them',
  DU: 'deleted-by-us',
  AA: 'both-added',
  UU: 'both-modified',
} as const;

const conflictCodes = {
  'both-deleted': 'DD',
  'added-by-us': 'AU',
  'deleted-by-them': 'UD',
  'added-by-them': 'UA',
  'deleted-by-us': 'DU',
  'both-added': 'AA',
  'both-modified': 'UU',
} as const;

const conflictSchema = z.codec(
  z.enum(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']),
  z.enum([
    'both-deleted',
    'added-by-us',
    'deleted-by-them',
    'added-by-them',
    'deleted-by-us',
    'both-added',
    'both-modified',
  ]),
  {
    decode: (code) => conflictKinds[code],
    encode: (kind) => conflictCodes[kind],
  },
);

export const gitChangeSelectionSchema = z.strictObject({
  scope: z.enum(['staged', 'unstaged']),
  oldPath: absentAsNull(relativePathSchema),
  newPath: absentAsNull(relativePathSchema),
});

const ordinaryChangeSchema = z.object({
  scope: z.enum(['staged', 'unstaged']),
  kind: z.enum(['added', 'modified', 'deleted', 'renamed', 'type-changed']),
  oldPath: absentAsNull(relativePathSchema),
  newPath: absentAsNull(relativePathSchema),
  oldMode: z.string().regex(/^[0-7]{6}$/),
  newMode: z.string().regex(/^[0-7]{6}$/),
  oldOid: absentAsNull(oidSchema),
  newOid: absentAsNull(oidSchema),
  supported: z.boolean(),
});

const untrackedChangeSchema = z.object({
  scope: z.literal('untracked'),
  path: relativePathSchema,
});

const unmergedChangeSchema = z.object({
  scope: z.literal('unmerged'),
  path: relativePathSchema,
  conflict: conflictSchema,
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
      name: absentAsNull(z.string()),
      upstream: absentAsNull(z.string()),
      ahead: z.number().int().nonnegative(),
      behind: z.number().int().nonnegative(),
      remoteName: absentAsNull(z.string()),
      sourceRef: absentAsNull(z.string()),
      upstreamOid: absentAsNull(oidSchema),
      stashes: z.array(z.object({ oid: oidSchema, message: z.string() })),
      discarded: z
        .array(
          z.object({
            oid: oidSchema,
            path: relativePathSchema,
            kind: z.enum(['hunk', 'rename']),
          }),
        )
        .max(50),
    })
    .optional(),
  consistency: z.literal('best-effort'),
  headOid: absentAsNull(oidSchema),
  inProgress: absentAsNull(z.enum(['merge', 'rebase'])),
  mergeHeadOid: absentAsNull(oidSchema),
  headCommit: absentAsNull(
    z.object({ subject: z.string(), body: z.string().optional() }),
  ),
  changes: z.array(gitChangeSchema).max(2000),
});

export type ReadGitStatusResponse = z.output<
  typeof readGitStatusResponseSchema
>;
