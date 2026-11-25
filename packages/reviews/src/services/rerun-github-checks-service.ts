import { Context, Effect, Layer } from 'effect';
import type {
  GitHubRepository,
  PullRequestRerunTarget,
} from '../models/pull-request.ts';
import { PullRequestActionRefusedError } from '../errors/pull-request-action-refused-error.ts';
import { GitHubCheckReader } from '../ports/github-check-reader.ts';
import { GitHubPullRequestActions } from '../ports/github-pull-request-actions.ts';
import { mapPullStatus } from '../rules/pull-request-status.ts';

export type GitHubWriteTarget =
  | {
      readonly kind: 'available';
      readonly repository: GitHubRepository;
      readonly account: string;
      readonly number: number;
    }
  | {
      readonly kind: 'unavailable';
      readonly reason: PullRequestActionRefusedError['reason'];
    };

export class RerunGitHubChecksService extends Context.Service<
  RerunGitHubChecksService,
  {
    readonly execute: (input: {
      target: GitHubWriteTarget;
      headSha: string;
      rerun: PullRequestRerunTarget;
    }) => Effect.Effect<void, PullRequestActionRefusedError>;
  }
>()('@porcelain/reviews/RerunGitHubChecksService') {
  static readonly layer = Layer.effect(
    RerunGitHubChecksService,
    Effect.gen(function* () {
      const reader = yield* GitHubCheckReader;
      const actions = yield* GitHubPullRequestActions;
      return {
        execute: Effect.fn('RerunGitHubChecksService.execute')(function* ({
          target,
          headSha,
          rerun,
        }) {
          if (target.kind === 'unavailable')
            return yield* new PullRequestActionRefusedError({
              reason: target.reason,
            });
          const pull = { ...target.repository, account: target.account };
          const status = mapPullStatus(
            yield* reader.status({ ...pull, number: target.number }).pipe(
              Effect.mapError(
                (error) =>
                  new PullRequestActionRefusedError({
                    reason:
                      error._tag === 'GitHubPullRequestNotFoundError'
                        ? 'pull-request-not-found'
                        : error.reason,
                  }),
              ),
            ),
          );
          if (status.headSha !== headSha)
            return yield* new PullRequestActionRefusedError({
              reason: 'head-changed',
            });
          const onHead = status.checks.some((check) =>
            rerun.kind === 'job'
              ? check.jobId === rerun.jobId
              : check.runId === rerun.runId,
          );
          if (!onHead)
            return yield* new PullRequestActionRefusedError({
              reason: 'not-rerunnable',
            });
          yield* actions.rerun({ ...pull, target: rerun });
        }),
      };
    }),
  );
}
