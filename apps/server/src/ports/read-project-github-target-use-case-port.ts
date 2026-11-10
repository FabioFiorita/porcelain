import { Context, type Effect } from 'effect';
import type {
  ProjectPullRequestParams,
  ReadPullRequestResponse,
} from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type { GitHubRepository } from '@porcelain/reviews/models';
export type ProjectGitHubTarget =
  | Exclude<ReadPullRequestResponse, { kind: 'available' }>
  | {
      kind: 'available';
      repository: GitHubRepository;
      account: string;
      number: number;
    };
export interface ReadProjectGitHubTargetUseCasePort {
  readonly execute: (
    input: ProjectPullRequestParams,
  ) => Effect.Effect<ProjectGitHubTarget, ProjectNotFoundError>;
}
export const ReadProjectGitHubTargetUseCasePort = Context.Service<
  '@porcelain/server/ReadProjectGitHubTargetUseCasePort',
  ReadProjectGitHubTargetUseCasePort
>('@porcelain/server/ReadProjectGitHubTargetUseCasePort');
