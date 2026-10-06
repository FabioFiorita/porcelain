import { Context, type Effect } from 'effect';
import type { QueueGitActionInput } from '@porcelain/git-actions/models';

export interface GitActionQueueRunner {
  execute(input: QueueGitActionInput): Effect.Effect<void>;
}
export const GitActionQueueRunner = Context.Service<
  '@porcelain/server/GitActionQueueRunner',
  GitActionQueueRunner
>('@porcelain/server/GitActionQueueRunner');
