import { Schema } from 'effect';
import {
  writerSchema,
  answerStateSchema,
  postStateSchema,
  walkthroughFailureSchema,
} from '@porcelain/walkthroughs/models';
import type {
  PostResult,
  WalkthroughConversationsView,
} from '@porcelain/walkthroughs/models';
import type { WorktreeParams } from '../shared/worktree-params.ts';
import { nullableAsUndefined } from '../shared/schema.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';

const MAX_MESSAGE_LENGTH = 8000;

const walkthroughAnchorSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('walkthrough') }),
  Schema.Struct({
    kind: Schema.Literal('stop'),
    title: Schema.String.check(Schema.isMinLength(1)),
  }),
]);
export const walkthroughMessageParamsSchema = Schema.Struct({
  ...worktreeParamsSchema.fields,
  messageId: Schema.String.check(Schema.isMinLength(1)),
});
export type WalkthroughMessageParams =
  typeof walkthroughMessageParamsSchema.Type;
export type WalkthroughPostInput = WorktreeParams & {
  readonly messageId?: string | undefined;
};
export type SaveWalkthroughMessageRequest =
  typeof saveWalkthroughMessageRequestSchema.Type;
export type WalkthroughConversationsResult = WalkthroughConversationsView;
export type WalkthroughPostResult = PostResult;
export const addWalkthroughMessageRequestSchema = Schema.Struct({
  writer: Schema.optional(writerSchema),
  runId: Schema.String.check(Schema.isMinLength(1)),
  anchor: walkthroughAnchorSchema,
  text: Schema.String.check(
    Schema.isTrimmed(),
    Schema.isMinLength(1),
    Schema.isMaxLength(MAX_MESSAGE_LENGTH),
  ),
});
export type AddWalkthroughMessageRequest =
  typeof addWalkthroughMessageRequestSchema.Type;
export const saveWalkthroughMessageRequestSchema = Schema.Struct({
  saved: Schema.Boolean,
});
export const readWalkthroughBriefQuery = {
  messageId: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
};

const answeredSchema = Schema.Struct({
  ...answerStateSchema.members[1].fields,
  costUsd: nullableAsUndefined(Schema.Number),
});
const developerMessageSchema = Schema.Struct({
  author: Schema.Literal('developer'),
  id: Schema.String,
  text: Schema.String,
  createdAt: Schema.String,
  post: postStateSchema,
});
const agentMessageSchema = Schema.Struct({
  author: Schema.Literal('agent'),
  id: Schema.String,
  replyTo: Schema.String,
  createdAt: Schema.String,
  state: Schema.Union([
    Schema.Struct({ status: Schema.Literal('answering') }),
    answeredSchema,
    Schema.Struct({
      status: Schema.Literal('failed'),
      failure: walkthroughFailureSchema,
    }),
  ]),
});
const walkthroughConversationSchema = Schema.Struct({
  runId: Schema.String,
  anchor: walkthroughAnchorSchema,
  messages: Schema.Array(
    Schema.Union([developerMessageSchema, agentMessageSchema]),
  ),
});
export const walkthroughConversationsResponseSchema = Schema.Struct({
  runId: nullableAsUndefined(Schema.String),
  pullRequestNumber: nullableAsUndefined(Schema.Int),
  conversations: Schema.Array(walkthroughConversationSchema),
});
export type WalkthroughConversationsResponse =
  typeof walkthroughConversationsResponseSchema.Type;
export const postWalkthroughMessagesResponseSchema = Schema.Struct({
  outcome: Schema.Union([
    Schema.Struct({ status: Schema.Literal('nothing') }),
    Schema.Struct({
      status: Schema.Literal('posted'),
      url: Schema.String,
      notPosted: Schema.Array(Schema.String),
    }),
    Schema.Struct({ status: Schema.Literal('brief'), text: Schema.String }),
  ]),
  view: walkthroughConversationsResponseSchema,
});
export const walkthroughBriefResponseSchema = Schema.Struct({
  text: nullableAsUndefined(Schema.String),
});
