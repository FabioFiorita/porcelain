import { Context, type Effect } from 'effect';
export interface WalkthroughQueue {
  readonly execute: (id: string) => Effect.Effect<void>;
}
export const WalkthroughQueue = Context.Service<
  '@porcelain/server/WalkthroughQueue',
  WalkthroughQueue
>('@porcelain/server/WalkthroughQueue');
