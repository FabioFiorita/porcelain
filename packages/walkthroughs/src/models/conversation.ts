import { Schema } from 'effect';
import {
  walkthroughFailureSchema,
  type WalkthroughRun,
} from './walkthrough.ts';

export const answerStateSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal('answering') }),
  Schema.Struct({
    status: Schema.Literal('answered'),
    text: Schema.String,
    answeredAt: Schema.String,
    durationMs: Schema.Number,
    costUsd: Schema.optional(Schema.Number),
  }),
  Schema.Struct({
    status: Schema.Literal('failed'),
    failure: walkthroughFailureSchema,
  }),
]);
export const postStateSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal('none') }),
  Schema.Struct({ status: Schema.Literal('saved') }),
  Schema.Struct({
    status: Schema.Literal('posted'),
    url: Schema.String,
    postedAt: Schema.String,
  }),
]);
export type AnswerState = typeof answerStateSchema.Type;
export type PostState = typeof postStateSchema.Type;
export type ConversationAnchor =
  | { readonly kind: 'walkthrough' }
  | { readonly kind: 'stop'; readonly title: string };
export type StoredWalkthroughMessage = {
  readonly writer?: WalkthroughRun['writer'] | undefined;
  readonly id: string;
  readonly runId: string;
  readonly worktreeId: string;
  readonly stopTitle: string | undefined;
  readonly text: string;
  readonly createdAt: string;
  readonly post: PostState;
  readonly answer: AnswerState;
};
type DeveloperMessage = {
  readonly author: 'developer';
  readonly id: string;
  readonly text: string;
  readonly createdAt: string;
  readonly post: PostState;
};
type AgentMessage = {
  readonly author: 'agent';
  readonly id: string;
  readonly replyTo: string;
  readonly createdAt: string;
  readonly state: AnswerState;
};
export type WalkthroughMessage = DeveloperMessage | AgentMessage;
export type WalkthroughConversation = {
  readonly runId: string;
  readonly anchor: ConversationAnchor;
  readonly messages: readonly WalkthroughMessage[];
};
export type WalkthroughConversationsView = {
  readonly runId: string | undefined;
  readonly pullRequestNumber: number | undefined;
  readonly conversations: readonly WalkthroughConversation[];
};
export type PostSelection =
  | { readonly kind: 'message'; readonly messageId: string }
  | { readonly kind: 'saved' };
export type PostPlan =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'already-posted'; readonly url: string }
  | {
      readonly kind: 'write';
      readonly pullRequestNumber: number | undefined;
      readonly repository: WalkthroughRun['pullRequestRepository'];
      readonly messageIds: readonly string[];
      readonly notPosted: readonly string[];
      readonly comment: string;
      readonly text: string;
    };
export type PostResult =
  | { readonly status: 'nothing' }
  | {
      readonly status: 'posted';
      readonly url: string;
      readonly notPosted: readonly string[];
    }
  | { readonly status: 'brief'; readonly text: string };
