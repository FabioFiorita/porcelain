import { PullRequestsApi } from '@porcelain/contracts/projects';
import { HttpApiBuilder } from 'effect/http-api';
import { Layer, type Context } from 'effect';
import { handlerAudit } from '../../diagnostics.ts';
import { requestBody } from '../../hooks/request-body.ts';
import type { ReadProjectPullRequestUseCase } from '../../../use-cases/projects/read-project-pull-request.ts';
import type { ReadProjectPullChecksUseCase } from '../../../use-cases/projects/read-project-pull-checks.ts';
import type { ArchivePullRequestUseCase } from '../../../use-cases/projects/archive-pull-request.ts';
import type { MergePullRequestUseCase } from '../../../use-cases/projects/merge-pull-request.ts';
import type { ReadProjectPullStatusUseCase } from '../../../use-cases/projects/read-project-pull-status.ts';
import type { ReadProjectCheckLogUseCase } from '../../../use-cases/projects/read-project-check-log.ts';
import type { RerunPullRequestChecksUseCase } from '../../../use-cases/projects/rerun-pull-request-checks.ts';
import type { CommentOnPullRequestUseCase } from '../../../use-cases/projects/comment-on-pull-request.ts';
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
  mergePullRequest: Context.Service.Shape<typeof MergePullRequestUseCase>;
  readProjectPullStatus: Context.Service.Shape<
    typeof ReadProjectPullStatusUseCase
  >;
  readProjectCheckLog: Context.Service.Shape<typeof ReadProjectCheckLogUseCase>;
  rerunPullRequestChecks: Context.Service.Shape<
    typeof RerunPullRequestChecksUseCase
  >;
  commentOnPullRequest: Context.Service.Shape<
    typeof CommentOnPullRequestUseCase
  >;
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
        .handle('mergePullRequest', ({ params, payload }) =>
          useCases.mergePullRequest.execute({ ...params, ...payload }),
        )
        .handle('readProjectPullStatus', ({ params }) =>
          useCases.readProjectPullStatus.execute(params),
        )
        .handle('readProjectCheckLog', ({ params, query }) =>
          useCases.readProjectCheckLog.execute({ ...params, ...query }),
        )
        .handle('rerunPullRequestChecks', ({ params, payload }) =>
          useCases.rerunPullRequestChecks.execute({ ...params, ...payload }),
        )
        .handle('commentOnPullRequest', ({ params, payload }) =>
          useCases.commentOnPullRequest.execute({ ...params, ...payload }),
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
