import { Schema } from 'effect';
import {
  walkthroughFailureSchema,
  type WalkthroughRun,
} from './walkthrough.ts';
import type { CallDecision } from './decision.ts';

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
export type AnswerState = typeof answerStateSchema.Type;
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
  readonly answer: AnswerState;
};
type DeveloperMessage = {
  readonly author: 'developer';
  readonly id: string;
  readonly text: string;
  readonly createdAt: string;
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
  readonly decisions: readonly CallDecision[];
};
