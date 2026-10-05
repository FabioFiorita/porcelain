import { Context, type Effect } from 'effect';

export type WorktreeChange =
  | { worktreeId: string; change: 'files'; paths: readonly string[] }
  | { worktreeId: string; change: 'git' };

export interface AnnounceWorktreeChangeUseCasePort {
  execute(input: WorktreeChange): Effect.Effect<void>;
}

export const AnnounceWorktreeChangeUseCasePort = Context.Service<
  '@porcelain/server/AnnounceWorktreeChangeUseCasePort',
  AnnounceWorktreeChangeUseCasePort
>('@porcelain/server/AnnounceWorktreeChangeUseCasePort');
