import { Context } from 'effect';
import type { ListProjectPullRequestsUseCase } from '../use-cases/reviews/list-project-pull-requests.ts';
export interface ListProjectPullRequestsUseCasePort extends Context.Service.Shape<
  typeof ListProjectPullRequestsUseCase
> {}
export const ListProjectPullRequestsUseCasePort = Context.Service<
  '@porcelain/server/ListProjectPullRequestsUseCasePort',
  ListProjectPullRequestsUseCasePort
>('@porcelain/server/ListProjectPullRequestsUseCasePort');
