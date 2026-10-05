import { Schema, SchemaTransformation } from 'effect';
import { nullableAsUndefined } from '../shared/schema.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/schema.ts';
import { CHANGED_PATHS, DISCARDED_CHANGES } from '../shared/limits.ts';

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

const conflictWireSchema = Schema.Literals([
  'DD',
  'AU',
  'UD',
  'UA',
  'DU',
  'AA',
  'UU',
]);
const conflictValueSchema = Schema.Literals([
  'both-deleted',
  'added-by-us',
  'deleted-by-them',
  'added-by-them',
  'deleted-by-us',
  'both-added',
  'both-modified',
]);
const conflictSchema = conflictWireSchema.pipe(
  Schema.decodeTo(
    conflictValueSchema,
    SchemaTransformation.transform<
      typeof conflictValueSchema.Type,
      typeof conflictWireSchema.Type
    >({
      decode: (code) => conflictKinds[code],
      encode: (kind) => conflictCodes[kind],
    }),
  ),
);

export const gitChangeSelectionSchema = Schema.Struct({
  scope: Schema.Literals(['staged', 'unstaged']),
  oldPath: nullableAsUndefined(relativePathSchema),
  newPath: nullableAsUndefined(relativePathSchema),
});

const ordinaryChangeSchema = Schema.Struct({
  scope: Schema.Literals(['staged', 'unstaged']),
  kind: Schema.Literals([
    'added',
    'modified',
    'deleted',
    'renamed',
    'type-changed',
  ]),
  oldPath: nullableAsUndefined(relativePathSchema),
  newPath: nullableAsUndefined(relativePathSchema),
  oldMode: Schema.String.check(Schema.isPattern(/^[0-7]{6}$/)),
  newMode: Schema.String.check(Schema.isPattern(/^[0-7]{6}$/)),
  oldOid: nullableAsUndefined(oidSchema),
  newOid: nullableAsUndefined(oidSchema),
  supported: Schema.Boolean,
});

const untrackedChangeSchema = Schema.Struct({
  scope: Schema.Literal('untracked'),
  path: relativePathSchema,
});

const unmergedChangeSchema = Schema.Struct({
  scope: Schema.Literal('unmerged'),
  path: relativePathSchema,
  conflict: conflictSchema,
});

export const gitChangeSchema = Schema.Union([
  ordinaryChangeSchema,
  untrackedChangeSchema,
  unmergedChangeSchema,
]);

export const readGitStatusResponseSchema = Schema.Struct({
  environmentId: Schema.String.check(Schema.isUUID()),
  worktreeId: worktreeIdSchema,
  statusToken: fingerprintSchema,
  branch: Schema.optional(
    Schema.Struct({
      name: nullableAsUndefined(Schema.String),
      upstream: nullableAsUndefined(Schema.String),
      ahead: Schema.Number.check(Schema.isInt()).check(
        Schema.isGreaterThanOrEqualTo(0),
      ),
      behind: Schema.Number.check(Schema.isInt()).check(
        Schema.isGreaterThanOrEqualTo(0),
      ),
      remoteName: nullableAsUndefined(Schema.String),
      sourceRef: nullableAsUndefined(Schema.String),
      upstreamOid: nullableAsUndefined(oidSchema),
      stashes: Schema.Array(
        Schema.Struct({ oid: oidSchema, message: Schema.String }),
      ),
      discarded: Schema.Array(
        Schema.Struct({
          oid: oidSchema,
          path: relativePathSchema,
          kind: Schema.Literals(['hunk', 'rename']),
        }),
      ).check(Schema.isMaxLength(DISCARDED_CHANGES)),
    }),
  ),
  consistency: Schema.Literal('best-effort'),
  headOid: nullableAsUndefined(oidSchema),
  inProgress: nullableAsUndefined(Schema.Literals(['merge', 'rebase'])),
  mergeHeadOid: nullableAsUndefined(oidSchema),
  headCommit: nullableAsUndefined(
    Schema.Struct({
      subject: Schema.String,
      body: Schema.optional(Schema.String),
    }),
  ),
  changes: Schema.Array(gitChangeSchema).check(
    Schema.isMaxLength(CHANGED_PATHS),
  ),
});

export type ReadGitStatusResponse = typeof readGitStatusResponseSchema.Type;
