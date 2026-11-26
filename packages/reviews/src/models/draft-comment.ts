import { Schema } from 'effect';

export const commentSideSchema = Schema.Literals(['additions', 'deletions']);
export type CommentSide = typeof commentSideSchema.Type;

export const draftCommentAnchorSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('lines'),
    path: Schema.String,
    side: commentSideSchema,
    start: Schema.Int,
    end: Schema.Int,
    text: Schema.String,
  }),
  Schema.Struct({ kind: Schema.Literal('file'), path: Schema.String }),
  Schema.Struct({ kind: Schema.Literal('step'), title: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal('node'),
    title: Schema.String,
    node: Schema.String,
  }),
]);
export type DraftCommentAnchor = typeof draftCommentAnchorSchema.Type;

const draftCommentPublicationSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal('draft') }),
  Schema.Struct({
    status: Schema.Literal('published'),
    url: Schema.String,
    publishedAt: Schema.String,
  }),
]);

const draftCommentSchema = Schema.Struct({
  id: Schema.String,
  anchor: draftCommentAnchorSchema,
  text: Schema.String,
  headOid: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  publication: draftCommentPublicationSchema,
});
export type DraftComment = typeof draftCommentSchema.Type;

export const draftCommentViewSchema = Schema.Struct({
  ...draftCommentSchema.fields,
  outdated: Schema.Boolean,
});
export type DraftCommentView = typeof draftCommentViewSchema.Type;

export type DraftCommentKey = {
  readonly worktreeId: string;
  readonly branch: string;
};

export type StoredDraftComment = DraftComment & DraftCommentKey;

export type PullRequestFile = {
  readonly path: string;
  readonly patch: string | undefined;
};

export type PullRequestDiff = {
  readonly headOid: string;
  readonly files: readonly PullRequestFile[];
};

const reviewSideSchema = Schema.Literals(['LEFT', 'RIGHT']);

export const inlineReviewCommentSchema = Schema.Struct({
  id: Schema.String,
  path: Schema.String,
  side: reviewSideSchema,
  startLine: Schema.optional(Schema.Int),
  line: Schema.Int,
  body: Schema.String,
});
export type InlineReviewComment = typeof inlineReviewCommentSchema.Type;

export const generalReviewCommentSchema = Schema.Struct({
  id: Schema.String,
  location: Schema.String,
  reason: Schema.Literals([
    'not-in-pull-request',
    'outdated',
    'file',
    'step',
    'node',
  ]),
  body: Schema.String,
});
export type GeneralReviewComment = typeof generalReviewCommentSchema.Type;

export type ReviewPlan = {
  readonly inline: readonly InlineReviewComment[];
  readonly general: readonly GeneralReviewComment[];
};

export type PostedReview = { readonly url: string };
