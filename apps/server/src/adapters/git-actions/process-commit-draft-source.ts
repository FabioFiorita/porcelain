import { Effect, Layer } from 'effect';
import { CommitPlanner } from '@porcelain/agents/commit-planning';
import { CommitDraftSource } from '@porcelain/git-actions/ports';

export const processCommitDraftSourceLayer = Layer.effect(
  CommitDraftSource,
  Effect.gen(function* () {
    const planner = yield* CommitPlanner;
    return {
      generate: (input) =>
        planner.plan(input).pipe(
          Effect.map((groups) => ({ kind: 'drafted' as const, groups })),
          Effect.catchTags({
            UnsupportedCommitModelError: () =>
              Effect.succeed({ kind: 'unsupported-model' as const }),
            ProviderNotInstalledError: () =>
              Effect.succeed({ kind: 'tool-missing' as const }),
            ProviderProcessFailedError: () =>
              Effect.succeed({ kind: 'tool-failed' as const }),
            CommitPlanFailedError: () =>
              Effect.succeed({ kind: 'failed' as const }),
          }),
        ),
    };
  }),
);
