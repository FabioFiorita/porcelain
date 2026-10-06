import { Context, type Effect } from 'effect';

export interface GitActionQueuePort {
  execute(input: { requestId: string }): Effect.Effect<void>;
}
export const GitActionQueuePort = Context.Service<
  '@porcelain/server/GitActionQueuePort',
  GitActionQueuePort
>('@porcelain/server/GitActionQueuePort');
