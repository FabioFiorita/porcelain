import { Clock, Duration, Effect, Layer } from 'effect';
import {
  captureGitPlatform,
  readUncommittedChangedAt,
} from '@porcelain/git/discovery';
import type {
  WorktreeActivity,
  WorktreeActivityTarget,
} from '@porcelain/projects/models';
import { WorktreeActivityReader } from '@porcelain/projects/ports';
import type { Limits } from '../../config/limits.ts';

type WorktreeActivityOptions = {
  git: Limits['git'];
  reads: number;
  timeout: Duration.Duration;
  budget: Duration.Duration;
};

const failed: WorktreeActivity = { kind: 'failed' };

export const gitWorktreeActivityReaderLayer = (
  options: WorktreeActivityOptions,
) =>
  Layer.effect(
    WorktreeActivityReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      const clock = yield* Clock.Clock;
      const readOne = Effect.fn('GitWorktreeActivityReader.readOne')(function* (
        target: WorktreeActivityTarget,
        deadline: number,
      ) {
        const remaining = deadline - (yield* clock.currentTimeMillis);
        if (remaining <= 0) return failed;
        return yield* readUncommittedChangedAt(target.path, options.git).pipe(
          provideGit,
          Effect.map((activity): WorktreeActivity => activity),
          Effect.timeout(
            Duration.min(options.timeout, Duration.millis(remaining)),
          ),
          Effect.orElseSucceed(() => failed),
        );
      });
      return {
        read: Effect.fn('GitWorktreeActivityReader.read')(function* (
          targets: readonly WorktreeActivityTarget[],
        ) {
          const deadline =
            (yield* clock.currentTimeMillis) +
            Duration.toMillis(options.budget);
          return yield* Effect.forEach(
            targets,
            (target) =>
              readOne(target, deadline).pipe(
                Effect.map((activity) => ({ ...target, activity })),
              ),
            { concurrency: options.reads },
          );
        }),
      };
    }),
  );
