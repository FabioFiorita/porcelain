import { Schema } from 'effect';
import {
  writerSchema,
  answerStateSchema,
  callDecisionSchema,
  walkthroughFailureSchema,
} from '@porcelain/walkthroughs/models';
import { nullableAsUndefined } from '../shared/schema.ts';
import type { WalkthroughConversationsView } from '@porcelain/walkthroughs/models';
import type { Principal } from '../access/principal.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';

const MAX_MESSAGE_LENGTH = 8000;

const walkthroughAnchorSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('walkthrough') }),
  Schema.Struct({
    kind: Schema.Literal('stop'),
    title: Schema.String.check(Schema.isMinLength(1)),
  }),
]);
export const walkthroughConversationParamsSchema = Schema.Struct({
  ...worktreeParamsSchema.fields,
  runId: Schema.String.check(Schema.isMinLength(1)),
});
export type WalkthroughConversationParams =
  typeof walkthroughConversationParamsSchema.Type;
export const walkthroughMessageParamsSchema = Schema.Struct({
  ...walkthroughConversationParamsSchema.fields,
  messageId: Schema.String.check(Schema.isMinLength(1)),
});
export type WalkthroughMessageParams =
  typeof walkthroughMessageParamsSchema.Type;
export type WalkthroughConversationsResult = WalkthroughConversationsView;
export const addWalkthroughMessageRequestSchema = Schema.Struct({
  writer: Schema.optional(writerSchema),
  anchor: walkthroughAnchorSchema,
  text: Schema.String.check(
    Schema.isTrimmed(),
    Schema.isMinLength(1),
    Schema.isMaxLength(MAX_MESSAGE_LENGTH),
  ),
});
export type AddWalkthroughMessageRequest =
  typeof addWalkthroughMessageRequestSchema.Type;
export const walkthroughCallParamsSchema = Schema.Struct({
  ...walkthroughConversationParamsSchema.fields,
  step: Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)),
  call: Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
  ),
});
type WalkthroughCallParams = typeof walkthroughCallParamsSchema.Type;
export const decideWalkthroughCallRequestSchema = Schema.Union([
  Schema.Struct({ decided: Schema.Literal(false) }),
  Schema.Struct({
    decided: Schema.Literal(true),
    option: Schema.optional(
      Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500)),
    ),
  }),
]);
export type DecideWalkthroughCallRequest =
  typeof decideWalkthroughCallRequestSchema.Type;
export type DecideWalkthroughCallInput = WalkthroughCallParams &
  DecideWalkthroughCallRequest & { readonly caller: Principal };

const answeredSchema = Schema.Struct({
  ...answerStateSchema.members[1].fields,
  costUsd: nullableAsUndefined(Schema.Number),
});
const developerMessageSchema = Schema.Struct({
  author: Schema.Literal('developer'),
  id: Schema.String,
  text: Schema.String,
  createdAt: Schema.String,
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
  decisions: Schema.Array(
    Schema.Struct({
      ...callDecisionSchema.fields,
      option: nullableAsUndefined(Schema.String),
    }),
  ),
});
export type WalkthroughConversationsResponse =
  typeof walkthroughConversationsResponseSchema.Type;
