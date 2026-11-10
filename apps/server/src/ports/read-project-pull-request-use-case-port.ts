import { Context, type Effect } from 'effect';
import type {
  ProjectPullRequestParams,
  ReadPullRequestResponse,
} from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
export interface ReadProjectPullRequestUseCasePort {
  readonly execute: (
    input: ProjectPullRequestParams,
  ) => Effect.Effect<ReadPullRequestResponse, ProjectNotFoundError>;
}
export const ReadProjectPullRequestUseCasePort = Context.Service<
  '@porcelain/server/ReadProjectPullRequestUseCasePort',
  ReadProjectPullRequestUseCasePort
>('@porcelain/server/ReadProjectPullRequestUseCasePort');
