import { Effect, Context, Layer } from 'effect';
import type { ProjectWorktrees } from '../models/project-worktrees.ts';
import type { WorktreeActivityObservation } from '../models/worktree-activity.ts';
import { WorktreeActivityReader } from '../ports/worktree-activity-reader.ts';
import { activityTargets } from '../rules/worktree-activity.ts';

export class ReadWorktreeActivityService extends Context.Service<
  ReadWorktreeActivityService,
  {
    readonly execute: (input: {
      listings: readonly ProjectWorktrees[];
    }) => Effect.Effect<readonly WorktreeActivityObservation[], never>;
  }
>()('@porcelain/projects/ReadWorktreeActivityService') {
  static readonly layer = Layer.effect(
    ReadWorktreeActivityService,
    Effect.gen(function* () {
      const activityCapability = yield* WorktreeActivityReader;

      return {
        execute: Effect.fn('ReadWorktreeActivityService.execute')(
          function* (input: {
            listings: readonly ProjectWorktrees[];
          }): Effect.fn.Return<readonly WorktreeActivityObservation[], never> {
            const targets = activityTargets(input.listings);
            if (targets.length === 0) return [];
            return yield* activityCapability.read(targets);
          },
        ),
      };
    }),
  );
}
