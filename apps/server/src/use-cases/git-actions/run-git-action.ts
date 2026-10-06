import { Context, Effect, Layer } from 'effect';
import {
  type RunGitActionRequest,
  type RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import {
  AcceptGitActionService,
  ExpireGitActionReceiptsService,
} from '@porcelain/git-actions/services';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { GitActionQueueRunner } from '../../ports/git-action-queue-runner.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';

export class RunGitActionUseCase extends Context.Service<
  RunGitActionUseCase,
  {
    readonly execute: (
      input: WorktreeParams & RunGitActionRequest,
    ) => Effect.Effect<
      RunGitActionResponse,
      | WorktreeAccessFailure
      | Effect.Error<
          ReturnType<
            Context.Service.Shape<typeof AcceptGitActionService>['execute']
          >
        >
    >;
  }
>()('@porcelain/server/RunGitActionUseCase') {
  static readonly layer = Layer.effect(
    RunGitActionUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const expire = yield* ExpireGitActionReceiptsService;
      const accept = yield* AcceptGitActionService;
      const queue = yield* GitActionQueueRunner;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('RunGitActionUseCase.execute')(function* (
          input: WorktreeParams & RunGitActionRequest,
        ) {
          const accepted = yield* access.transaction(
            input.worktreeId,
            (worktree) => Effect.succeed(worktree),
            (worktree) =>
              Effect.gen(function* () {
                const { upstreamOid, ...expected } = input.expected;
                yield* expire.execute({ worktreeId: input.worktreeId });
                return yield* accept.execute({
                  projectId: worktree.projectId,
                  worktreeId: input.worktreeId,
                  requestId: input.requestId,
                  intent: input.input,
                  expected:
                    upstreamOid === undefined
                      ? expected
                      : {
                          ...expected,
                          upstream: { oid: upstreamOid ?? undefined },
                        },
                });
              }),
            (accepted) =>
              Effect.uninterruptible(
                Effect.gen(function* () {
                  if (accepted.kind !== 'accepted') return;
                  yield* events.gitActionChanged(accepted.receipt).pipe(
                    Effect.ensuring(
                      queue.execute({
                        requestId: accepted.receipt.requestId,
                      }),
                    ),
                  );
                }),
              ),
            { requireAvailableProject: true },
          );
          return accepted.receipt;
        }),
      };
    }),
  );
}
