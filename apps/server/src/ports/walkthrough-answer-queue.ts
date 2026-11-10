import { Context, type Effect } from 'effect';
export interface WalkthroughAnswerQueue {
  readonly execute: () => Effect.Effect<void>;
}
export const WalkthroughAnswerQueue = Context.Service<
  '@porcelain/server/WalkthroughAnswerQueue',
  WalkthroughAnswerQueue
>('@porcelain/server/WalkthroughAnswerQueue');
