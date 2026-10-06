import { isoDateTimeSchema } from '../shared/schema.ts';
import { Schema } from 'effect';
import {
  COMMENT_BODY_LENGTH,
  COMMENT_THREADS_PER_WORKTREE,
  COMMIT_PARENTS,
  EVIDENCE_TOKEN_LENGTH,
  LINE_NUMBER_MAX,
} from '../shared/limits.ts';
import { nullableAsUndefined } from '../shared/schema.ts';
import { branchRefSchema } from '../shared/branch-ref.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/schema.ts';

const comparisonSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('worktree'),
    scope: Schema.Literals(['staged', 'unstaged', 'untracked']),
  }),
  Schema.Struct({ kind: Schema.Literal('file') }),
  Schema.Struct({
    kind: Schema.Literal('commit'),
    parent: Schema.Number.check(Schema.isInt())
      .check(Schema.isGreaterThanOrEqualTo(1))
      .check(Schema.isLessThanOrEqualTo(COMMIT_PARENTS)),
  }),
  Schema.Struct({ kind: Schema.Literal('branch'), base: branchRefSchema }),
]);
const evidence = {
  comparison: Schema.optional(comparisonSchema),
  revision: Schema.optional(
    Schema.String.check(Schema.isMinLength(1)).check(
      Schema.isMaxLength(EVIDENCE_TOKEN_LENGTH),
    ),
  ),
  contentFingerprint: Schema.optional(
    Schema.String.check(Schema.isMinLength(1)).check(
      Schema.isMaxLength(EVIDENCE_TOKEN_LENGTH),
    ),
  ),
};
const bodySchema = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(COMMENT_BODY_LENGTH))
  .check(
    Schema.makeFilter(
      (value: string) => value.trim().length > 0 && !value.includes('\0'),
    ),
  );

const commentAuthorSchema = Schema.Literals(['reviewer', 'agent']);

const commentAnchorSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('change'),
    filePath: Schema.optional(Schema.Never),
    ...evidence,
  }),
  Schema.Struct({
    kind: Schema.Literal('file'),
    filePath: relativePathSchema,
    ...evidence,
  }),
  Schema.Struct({
    kind: Schema.Literal('codeRange'),
    filePath: relativePathSchema,
    startLine: Schema.Number.check(Schema.isInt())
      .check(Schema.isGreaterThanOrEqualTo(1))
      .check(Schema.isLessThanOrEqualTo(LINE_NUMBER_MAX)),
    endLine: Schema.Number.check(Schema.isInt())
      .check(Schema.isGreaterThanOrEqualTo(1))
      .check(Schema.isLessThanOrEqualTo(LINE_NUMBER_MAX)),
    side: Schema.optional(Schema.Literals(['additions', 'deletions'])),
    ...evidence,
  }),
]);

const commentMessageSchema = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  body: bodySchema,
  author: commentAuthorSchema,
  createdAt: Schema.optional(isoDateTimeSchema),
  editedAt: Schema.optional(isoDateTimeSchema),
});

const commentThreadSchema = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  worktreeId: worktreeIdSchema,
  anchor: commentAnchorSchema,
  resolved: Schema.Boolean,
  messages: Schema.Array(commentMessageSchema).check(Schema.isMinLength(1)),
  revision: Schema.Number.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0),
  ),
});

export const commentThreadParamsSchema = Schema.Struct({
  worktreeId: worktreeIdSchema,
  threadId: Schema.String.check(Schema.isUUID()),
});

export const commentThreadScopeSchema = Schema.Literals(['waiting', 'all']);
const listCommentThreadsQuerySchema = Schema.Struct({
  scope: Schema.optional(commentThreadScopeSchema),
});
const commentWriterSchema = Schema.Struct({
  kind: Schema.Literals(['owner', 'device', 'agent']),
});
export const listCommentThreadsResponseSchema =
  Schema.Array(commentThreadSchema);

export const createCommentThreadRequestSchema = Schema.Struct({
  threadId: Schema.optional(Schema.String.check(Schema.isUUID())),
  messageId: Schema.optional(Schema.String.check(Schema.isUUID())),
  anchor: commentAnchorSchema,
  body: bodySchema,
});
export const createCommentThreadResponseSchema = commentThreadSchema;

export const replyToCommentRequestSchema = Schema.Struct({
  messageId: Schema.optional(Schema.String.check(Schema.isUUID())),
  body: bodySchema,
});
export const replyToCommentResponseSchema = commentThreadSchema;

export const updateCommentThreadRequestSchema = Schema.Struct({
  resolved: Schema.Boolean,
});
export const updateCommentThreadResponseSchema = commentThreadSchema;

export const editCommentMessageRequestSchema = Schema.Struct({
  messageId: Schema.String.check(Schema.isUUID()),
  body: bodySchema,
});
export const deleteCommentMessageQuerySchema = Schema.Struct({
  messageId: Schema.String.check(Schema.isUUID()),
});
export const editCommentMessageResponseSchema = commentThreadSchema;
export const deleteCommentMessageResponseSchema = Schema.Struct({
  threadId: Schema.String.check(Schema.isUUID()),
  thread: nullableAsUndefined(commentThreadSchema),
});

export const deleteResolvedCommentsRequestSchema = Schema.Struct({
  threads: Schema.Array(
    Schema.Struct({
      threadId: Schema.String.check(Schema.isUUID()),
      revision: Schema.Number.check(Schema.isInt()).check(
        Schema.isGreaterThanOrEqualTo(0),
      ),
    }),
  )
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(COMMENT_THREADS_PER_WORKTREE)),
});
export const deleteResolvedCommentsResponseSchema = Schema.Struct({
  deleted: Schema.Array(Schema.String.check(Schema.isUUID())),
  skipped: Schema.Array(Schema.String.check(Schema.isUUID())),
});

export const markCommentsSeenRequestSchema = Schema.Struct({
  throughRevision: Schema.Number.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0),
  ),
});
export const markCommentsSeenResponseSchema = Schema.Struct({
  worktreeId: worktreeIdSchema,
  seenThrough: Schema.Number.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0),
  ),
});

export type CommentThreadParams = typeof commentThreadParamsSchema.Type;
export type ListCommentThreadsQuery = typeof listCommentThreadsQuerySchema.Type;
type CommentWriter = typeof commentWriterSchema.Type;
export type CommentAuthor = { writer: CommentWriter };
export type ListCommentThreadsResponse =
  typeof listCommentThreadsResponseSchema.Type;
export type CreateCommentThreadRequest =
  typeof createCommentThreadRequestSchema.Type;
export type CreateCommentThreadResponse =
  typeof createCommentThreadResponseSchema.Type;
export type ReplyToCommentRequest = typeof replyToCommentRequestSchema.Type;
export type ReplyToCommentResponse = typeof replyToCommentResponseSchema.Type;
export type UpdateCommentThreadRequest =
  typeof updateCommentThreadRequestSchema.Type;
export type UpdateCommentThreadResponse =
  typeof updateCommentThreadResponseSchema.Type;
export type DeleteCommentMessageQuery =
  typeof deleteCommentMessageQuerySchema.Type;
export type EditCommentMessageRequest =
  typeof editCommentMessageRequestSchema.Type;
export type EditCommentMessageResponse =
  typeof editCommentMessageResponseSchema.Type;
export type DeleteCommentMessageResponse =
  typeof deleteCommentMessageResponseSchema.Type;
export type DeleteResolvedCommentsRequest =
  typeof deleteResolvedCommentsRequestSchema.Type;
export type DeleteResolvedCommentsResponse =
  typeof deleteResolvedCommentsResponseSchema.Type;
export type MarkCommentsSeenRequest = typeof markCommentsSeenRequestSchema.Type;
export type MarkCommentsSeenResponse =
  typeof markCommentsSeenResponseSchema.Type;
