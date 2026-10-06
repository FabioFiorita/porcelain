import { Context, type Effect } from 'effect';
import { type QueuedGitActionInput } from '@porcelain/git-actions/models';

export interface RunQueuedGitActionUseCasePort {
  execute(input: QueuedGitActionInput): Effect.Effect<void>;
}
export const RunQueuedGitActionUseCasePort = Context.Service<
  '@porcelain/server/RunQueuedGitActionUseCasePort',
  RunQueuedGitActionUseCasePort
>('@porcelain/server/RunQueuedGitActionUseCasePort');
