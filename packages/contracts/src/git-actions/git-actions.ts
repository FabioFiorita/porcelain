import { Effect, Schema } from 'effect';
import { nullableAsUndefined } from '../shared/schema.ts';
import { apiErrorSchema } from '../shared/api-error.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { gitActionReceiptSchema } from '../shared/git-action-receipt.ts';
import { oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { utf8ByteLength } from '../shared/utf8-byte-length.ts';
import { worktreeIdSchema } from '../shared/schema.ts';
import {
  CHANGED_PATHS,
  COMMIT_MESSAGE_BYTES,
  GIT_REF_LENGTH,
} from '../shared/limits.ts';

const messageSchema = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(COMMIT_MESSAGE_BYTES))
  .check(
    Schema.makeFilter(
      (value: string) =>
        value.trim().length > 0 &&
        !value.includes('\0') &&
        utf8ByteLength(value) <= COMMIT_MESSAGE_BYTES,
    ),
  );
const refSchema = Schema.String.check(Schema.isMaxLength(GIT_REF_LENGTH))
  .check(Schema.isPattern(/^refs\/heads\/[\s\S]/u))
  .check(Schema.makeFilter((value: string) => !value.includes('\0')));
const remoteSchema = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/),
);
const expectedFileSchema = Schema.Struct({
  path: relativePathSchema,
  fingerprint: fingerprintSchema,
});

const gitActionRequestParamsSchema = Schema.Struct({
  worktreeId: worktreeIdSchema,
  requestId: Schema.String.check(Schema.isUUID()),
});

const gitActionIntentSchema = Schema.Union([
  Schema.Struct({
    action: Schema.Literal('fetch'),
    remoteName: remoteSchema,
    sourceRef: refSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('pull'),
    remoteName: remoteSchema,
    sourceRef: refSchema,
    strategy: Schema.optional(Schema.Literals(['ff-only', 'merge', 'rebase'])),
  }),
  Schema.Struct({
    action: Schema.Literal('push'),
    remoteName: remoteSchema,
    destinationRef: refSchema,
    allowCreate: Schema.Boolean,
  }),
  Schema.Struct({
    action: Schema.Literal('commit'),
    message: messageSchema,
    paths: Schema.Array(relativePathSchema).check(
      Schema.isMaxLength(CHANGED_PATHS),
    ),
  }),
  Schema.Struct({
    action: Schema.Literal('amend'),
    message: messageSchema,
    paths: Schema.Array(relativePathSchema).check(
      Schema.isMaxLength(CHANGED_PATHS),
    ),
  }),
  Schema.Struct({
    action: Schema.Literal('stash-create'),
    message: messageSchema,
    includeUntracked: Schema.Boolean,
  }),
  Schema.Struct({
    action: Schema.Literals(['stash-apply', 'stash-pop']),
    stashOid: oidSchema,
    restoreIndex: Schema.Boolean.pipe(
      Schema.withDecodingDefaultKey(Effect.succeed(false)),
    ),
  }),
  Schema.Struct({
    action: Schema.Literal('discard'),
    path: relativePathSchema,
    hunk: Schema.optional(
      Schema.Struct({
        scope: Schema.Literals(['staged', 'unstaged']),
        startLine: Schema.Number.check(Schema.isInt()).check(
          Schema.isGreaterThan(0),
        ),
        endLine: Schema.Number.check(Schema.isInt()).check(
          Schema.isGreaterThan(0),
        ),
      }),
    ),
  }),
]);

const gitActionExpectationSchema = Schema.Struct({
  headOid: nullableAsUndefined(oidSchema),
  branch: nullableAsUndefined(Schema.String),
  inProgress: nullableAsUndefined(Schema.Literals(['merge', 'rebase'])),
  mergeHeadOid: nullableAsUndefined(oidSchema),
  upstreamOid: Schema.optional(Schema.NullOr(oidSchema)),
  files: Schema.optional(
    Schema.Array(expectedFileSchema).check(Schema.isMaxLength(CHANGED_PATHS)),
  ),
});

export const runGitActionRequestSchema = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID()),
  input: gitActionIntentSchema,
  expected: gitActionExpectationSchema,
});
export const runGitActionResponseSchema = gitActionReceiptSchema;
export const runGitActionRejectedResponseSchema = Schema.Union([
  gitActionReceiptSchema,
  apiErrorSchema,
]);

export const readGitActionReceiptParamsSchema = gitActionRequestParamsSchema;
export const readGitActionReceiptResponseSchema = gitActionReceiptSchema;

export const dismissInterruptedGitActionParamsSchema =
  gitActionRequestParamsSchema;
export const dismissInterruptedGitActionResponseSchema = Schema.Struct({
  dismissed: Schema.Literal(true),
});

export type RunGitActionRequest = typeof runGitActionRequestSchema.Type;
export type RunGitActionResponse = typeof runGitActionResponseSchema.Type;
export type ReadGitActionReceiptParams =
  typeof readGitActionReceiptParamsSchema.Type;
export type ReadGitActionReceiptResponse =
  typeof readGitActionReceiptResponseSchema.Type;
export type DismissInterruptedGitActionParams =
  typeof dismissInterruptedGitActionParamsSchema.Type;
export type DismissInterruptedGitActionResponse =
  typeof dismissInterruptedGitActionResponseSchema.Type;
