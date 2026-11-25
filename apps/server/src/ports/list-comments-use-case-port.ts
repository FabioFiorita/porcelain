import { Context, type Effect } from 'effect';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { CommentsResponse } from '@porcelain/contracts/comments';
import type { WorktreeAccessFailure } from './worktree-access-failure.ts';

export interface ListCommentsUseCasePort {
  readonly execute: (input: {
    readonly worktreeId: string;
  }) => Effect.Effect<CommentsResponse, WorktreeAccessFailure | GitIoFailure>;
}
export const ListCommentsUseCasePort = Context.Service<
  '@porcelain/server/ListCommentsUseCasePort',
  ListCommentsUseCasePort
>('@porcelain/server/ListCommentsUseCasePort');
