import { Context, Effect, Layer } from 'effect';
import { ReadInventoryUseCasePort } from '../../ports/read-inventory-use-case-port.ts';
import { ListProjectPullRequestsUseCasePort } from '../../ports/list-project-pull-requests-use-case-port.ts';
import { QueueWalkthroughUseCasePort } from '../../ports/queue-walkthrough-use-case-port.ts';
export class PollAutomaticWalkthroughsUseCase extends Context.Service<
  PollAutomaticWalkthroughsUseCase,
  {
    readonly execute: () => Effect.Effect<void>;
  }
>()('@porcelain/server/PollAutomaticWalkthroughsUseCase') {
  static readonly layer = Layer.effect(
    PollAutomaticWalkthroughsUseCase,
    Effect.gen(function* () {
      const inventory = yield* ReadInventoryUseCasePort;
      const pulls = yield* ListProjectPullRequestsUseCasePort;
      const start = yield* QueueWalkthroughUseCasePort;
      return {
        execute: Effect.fn('PollAutomaticWalkthroughsUseCase.execute')(
          function* () {
            const report = yield* inventory.execute().pipe(Effect.option);
            if (report._tag === 'None') return;
            for (const project of report.value.projects) {
              const settings = project.walkthroughSettings ?? {
                mode: 'manual',
                provider: 'claude',
              };
              if (!project.available || settings.mode !== 'automatic') continue;
              const result = yield* pulls
                .execute({ projectId: project.id })
                .pipe(Effect.option);
              if (result._tag === 'None' || result.value.kind !== 'available')
                continue;
              for (const pull of result.value.pullRequests) {
                if (pull.state !== 'open') continue;
                const worktree = project.worktrees.find(
                  (worktree) =>
                    worktree.available && worktree.branch === pull.headBranch,
                );
                if (!worktree) continue;
                yield* start
                  .execute({
                    worktreeId: worktree.id,
                    automaticKey: pull.url.toLowerCase(),
                    pullRequestNumber: pull.number,
                    writer: {
                      provider: settings.provider,
                      model:
                        settings.provider === 'claude'
                          ? 'claude-opus-5-5'
                          : 'gpt-5.4',
                    },
                  })
                  .pipe(Effect.ignore);
              }
            }
          },
        ),
      };
    }),
  );
}
