import { Effect } from 'effect';
import type { ProjectPullRequestParams } from '@porcelain/contracts/projects';
import type {
  GitHubReadError,
  GitHubPullRequestNotFoundError,
} from '@porcelain/reviews/errors';
import type { GitHubRepository } from '@porcelain/reviews/models';
import type { ReadProjectGitHubTargetUseCasePort } from '../ports/read-project-github-target-use-case-port.ts';

export const readProjectPull = Effect.fn('Projects.readProjectPull')(function* <
  T,
>(
  target: ReadProjectGitHubTargetUseCasePort,
  input: ProjectPullRequestParams,
  read: (
    pull: GitHubRepository & { account: string; number: number },
  ) => Effect.Effect<T, GitHubReadError | GitHubPullRequestNotFoundError>,
) {
  const linked = yield* target.execute(input);
  if (linked.kind !== 'available') return linked;
  const result = yield* read({
    ...linked.repository,
    account: linked.account,
    number: linked.number,
  }).pipe(Effect.result);
  if (result._tag === 'Failure')
    return {
      kind: 'unavailable' as const,
      reason:
        result.failure._tag === 'GitHubPullRequestNotFoundError'
          ? ('pull-request-not-found' as const)
          : result.failure.reason,
    };
  return {
    kind: 'available' as const,
    account: linked.account,
    result: result.success,
  };
});
