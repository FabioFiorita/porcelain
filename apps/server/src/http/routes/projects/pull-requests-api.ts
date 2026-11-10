import { PullRequestsApi } from '@porcelain/contracts/projects';
import { HttpApiBuilder } from 'effect/http-api';
import { Layer, type Context } from 'effect';
import { handlerAudit } from '../../diagnostics.ts';
import { requestBody } from '../../hooks/request-body.ts';
import type { ReadProjectPullRequestUseCase } from '../../../use-cases/projects/read-project-pull-request.ts';
import type { ReadProjectPullChecksUseCase } from '../../../use-cases/projects/read-project-pull-checks.ts';
import type { ArchivePullRequestUseCase } from '../../../use-cases/projects/archive-pull-request.ts';
import type { ReadProjectGitHubAccountUseCase } from '../../../use-cases/reviews/read-project-github-account.ts';
import type { ListProjectPullRequestsUseCase } from '../../../use-cases/reviews/list-project-pull-requests.ts';
type UseCases = {
  readProjectPullRequest: Context.Service.Shape<
    typeof ReadProjectPullRequestUseCase
  >;
  readProjectPullChecks: Context.Service.Shape<
    typeof ReadProjectPullChecksUseCase
  >;
  archivePullRequest: Context.Service.Shape<typeof ArchivePullRequestUseCase>;
  readProjectGitHubAccount: Context.Service.Shape<
    typeof ReadProjectGitHubAccountUseCase
  >;
  listProjectPullRequests: Context.Service.Shape<
    typeof ListProjectPullRequestsUseCase
  >;
};
export function pullRequestsRoutes(useCases: UseCases) {
  const handlers = HttpApiBuilder.group(
    PullRequestsApi,
    'pullRequests',
    (handlers) =>
      handlers
        .handle('readProjectPullRequest', ({ params }) =>
          useCases.readProjectPullRequest.execute(params),
        )
        .handle('readProjectPullChecks', ({ params }) =>
          useCases.readProjectPullChecks.execute(params),
        )
        .handle('archivePullRequest', ({ params, payload }) =>
          useCases.archivePullRequest.execute({ ...params, ...payload }),
        )
        .handle('listProjectPullRequests', ({ params }) =>
          useCases.listProjectPullRequests.execute(params),
        )
        .handle('readProjectGitHubAccount', ({ params }) =>
          useCases.readProjectGitHubAccount.execute(params),
        )
        .handle('setProjectGitHubAccount', ({ params, payload }) =>
          useCases.readProjectGitHubAccount.execute({
            ...params,
            override: { account: payload.account },
          }),
        ),
  );
  return HttpApiBuilder.layer(PullRequestsApi).pipe(
    Layer.provide(handlers),
    Layer.provide(handlerAudit.layer),
    Layer.provide(requestBody.layer),
  );
}
