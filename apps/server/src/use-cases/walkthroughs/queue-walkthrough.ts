import { Context, Effect, Layer } from 'effect';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { StartWalkthroughRequest } from '@porcelain/contracts/walkthroughs';
import { StartWalkthroughService } from '@porcelain/walkthroughs/services';
import type { WalkthroughRun } from '@porcelain/walkthroughs/models';
import type { WalkthroughFailedError } from '@porcelain/walkthroughs/errors';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { WalkthroughQueue } from '../../ports/walkthrough-queue.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '@porcelain/git/errors';
export class QueueWalkthroughUseCase extends Context.Service<
  QueueWalkthroughUseCase,
  {
    readonly execute: (
      input: WorktreeParams &
        StartWalkthroughRequest & { automaticKey?: string },
    ) => Effect.Effect<
      WalkthroughRun,
      WorktreeAccessFailure | GitIoFailure | WalkthroughFailedError
    >;
  }
>()('@porcelain/server/QueueWalkthroughUseCase') {
  static readonly layer = Layer.effect(
    QueueWalkthroughUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const service = yield* StartWalkthroughService;
      const queue = yield* WalkthroughQueue;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('QueueWalkthroughUseCase.execute')(
          function* (input) {
            const accepted = yield* access.write(input.worktreeId, (worktree) =>
              service.execute({
                ...input,
                base: input.base,
                writer: input.writer,
                pullRequestNumber: input.pullRequestNumber,
                projectId: worktree.projectId,
                worktreePath: worktree.path,
              }),
            );
            yield* queue.execute(accepted.id);
            yield* events.worktreeChanged({
              worktreeId: input.worktreeId,
              change: 'walkthrough',
            });
            return accepted;
          },
        ),
      };
    }),
  );
}
