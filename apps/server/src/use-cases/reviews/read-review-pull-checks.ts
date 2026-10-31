import { Context, Effect, Layer } from 'effect';
import type {
  ReadPullChecksResponse,
  ReviewParams,
} from '@porcelain/contracts/reviews';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { ReadGitHubPullChecksService } from '@porcelain/reviews/services';
import { ReadReviewGitHubTargetUseCasePort } from '../../ports/read-review-github-target-use-case-port.ts';
export class ReadReviewPullChecksUseCase extends Context.Service<
  ReadReviewPullChecksUseCase,
  {
    readonly execute: (
      input: ReviewParams,
    ) => Effect.Effect<
      ReadPullChecksResponse,
      ReviewNotFoundError | ProjectNotFoundError
    >;
  }
>()('@porcelain/server/ReadReviewPullChecksUseCase') {
  static readonly layer = Layer.effect(
    ReadReviewPullChecksUseCase,
    Effect.gen(function* () {
      const target = yield* ReadReviewGitHubTargetUseCasePort;
      const checks = yield* ReadGitHubPullChecksService;
      return {
        execute: Effect.fn('ReadReviewPullChecksUseCase.execute')(
          function* (input) {
            const linked = yield* target.execute(input);
            if (linked.kind !== 'available') return linked;
            const result = yield* checks
              .execute({
                ...linked.repository,
                account: linked.account,
                number: linked.number,
              })
              .pipe(Effect.result);
            if (result._tag === 'Failure')
              return {
                kind: 'unavailable',
                reason:
                  result.failure._tag === 'GitHubPullRequestNotFoundError'
                    ? 'offline'
                    : result.failure.reason,
              };
            return { kind: 'available', ...result.success };
          },
        ),
      };
    }),
  );
}
