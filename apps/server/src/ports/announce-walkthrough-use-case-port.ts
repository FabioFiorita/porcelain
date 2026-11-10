import { Context, type Effect } from 'effect';
export interface AnnounceWalkthroughUseCasePort {
  readonly execute: (input: {
    worktreeId: string;
    change?: 'walkthrough-conversations';
  }) => Effect.Effect<void>;
}
export const AnnounceWalkthroughUseCasePort = Context.Service<
  '@porcelain/server/AnnounceWalkthroughUseCasePort',
  AnnounceWalkthroughUseCasePort
>('@porcelain/server/AnnounceWalkthroughUseCasePort');
