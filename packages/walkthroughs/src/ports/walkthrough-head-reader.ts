import { Context, type Effect } from 'effect';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { WorktreeRead } from '@porcelain/effects/worktree';
export interface WalkthroughHeadReader {
  readonly read: (input: {
    worktreeId: string;
  }) => Effect.Effect<
    { branch: string | undefined; headOid: string | undefined },
    GitIoFailure,
    WorktreeRead
  >;
}
export const WalkthroughHeadReader = Context.Service<
  '@porcelain/walkthroughs/WalkthroughHeadReader',
  WalkthroughHeadReader
>('@porcelain/walkthroughs/WalkthroughHeadReader');
