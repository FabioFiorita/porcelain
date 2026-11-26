import type { WorktreeParams } from '../shared/worktree-params.ts';
import { Schema } from 'effect';
import {
  commentSideSchema,
  draftCommentViewSchema,
  generalReviewCommentSchema,
  githubUnavailableReasonSchema,
  inlineReviewCommentSchema,
} from '@porcelain/reviews/models';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';

const MAX_COMMENT_LENGTH = 8000;
const MAX_TITLE_LENGTH = 500;
const MAX_SNAPSHOT_LENGTH = 64_000;

const commentText = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(MAX_COMMENT_LENGTH),
);
const lineNumber = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));
const title = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MAX_TITLE_LENGTH),
);

const commentAnchorRequestSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('lines'),
    path: relativePathSchema,
    side: commentSideSchema,
    start: lineNumber,
    end: lineNumber,
    text: Schema.String.check(Schema.isMaxLength(MAX_SNAPSHOT_LENGTH)),
  }),
  Schema.Struct({ kind: Schema.Literal('file'), path: relativePathSchema }),
  Schema.Struct({ kind: Schema.Literal('step'), title }),
  Schema.Struct({ kind: Schema.Literal('node'), title, node: title }),
]);

export const commentParamsSchema = Schema.Struct({
  ...worktreeParamsSchema.fields,
  commentId: Schema.String.check(Schema.isMinLength(1)),
});
type CommentParams = typeof commentParamsSchema.Type;

export const addCommentRequestSchema = Schema.Struct({
  anchor: commentAnchorRequestSchema,
  text: commentText,
});
export type AddCommentRequest = typeof addCommentRequestSchema.Type;

export const editCommentRequestSchema = Schema.Struct({ text: commentText });
type EditCommentRequest = typeof editCommentRequestSchema.Type;

export const commentsResponseSchema = Schema.Struct({
  branch: Schema.String,
  headOid: Schema.String,
  comments: Schema.Array(draftCommentViewSchema),
  markdown: Schema.String,
});
export type CommentsResponse = typeof commentsResponseSchema.Type;

const reviewPullRequestIdentity = Schema.Struct({
  owner: Schema.String.check(Schema.isMinLength(1)),
  repo: Schema.String.check(Schema.isMinLength(1)),
  number: lineNumber,
});

export const reviewPreviewResponseSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('available'),
    pullRequest: Schema.Struct({
      ...reviewPullRequestIdentity.fields,
      url: Schema.String,
      title: Schema.String,
    }),
    headOid: Schema.String,
    draftRevision: fingerprintSchema,
    inline: Schema.Array(inlineReviewCommentSchema),
    general: Schema.Array(generalReviewCommentSchema),
  }),
  Schema.Struct({
    kind: Schema.Literal('unavailable'),
    reason: Schema.Union([
      githubUnavailableReasonSchema,
      Schema.Literals(['no-pull-request', 'no-comments']),
    ]),
  }),
]);
export type ReviewPreviewResponse = typeof reviewPreviewResponseSchema.Type;

export const publishReviewRequestSchema = Schema.Struct({
  pullRequest: reviewPullRequestIdentity,
  draftRevision: fingerprintSchema,
  inlineIds: Schema.Array(Schema.String),
  headOid: Schema.String.check(Schema.isMinLength(1)),
  summary: Schema.String.check(Schema.isMaxLength(MAX_COMMENT_LENGTH)),
  bodies: Schema.Record(Schema.String, commentText),
});
export type PublishReviewRequest = typeof publishReviewRequestSchema.Type;

export const publishReviewResponseSchema = Schema.Struct({
  url: Schema.String,
  view: commentsResponseSchema,
});
export type PublishReviewResponse = typeof publishReviewResponseSchema.Type;

export const ownerCommentsQuerySchema = Schema.Struct({
  path: Schema.String.check(Schema.isMinLength(1)),
});
export type OwnerCommentsQuery = typeof ownerCommentsQuerySchema.Type;

export type ChangeCommentInput =
  | (WorktreeParams & AddCommentRequest & { readonly kind: 'add' })
  | (CommentParams & EditCommentRequest & { readonly kind: 'edit' })
  | (CommentParams & { readonly kind: 'delete' });
