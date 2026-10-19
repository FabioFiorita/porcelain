import { Context, type Effect } from 'effect';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type {
  GitHubAccountResult,
  GitHubRepository,
} from '@porcelain/reviews/models';
export interface ResolveProjectGitHubUseCasePort {
  execute(input: {
    projectId: string;
    override?: { account: string | undefined };
  }): Effect.Effect<
    {
      repository: GitHubRepository | undefined;
      selection: GitHubAccountResult;
    },
    ProjectNotFoundError
  >;
}
export const ResolveProjectGitHubUseCasePort = Context.Service<
  '@porcelain/server/ResolveProjectGitHubUseCasePort',
  ResolveProjectGitHubUseCasePort
>('@porcelain/server/ResolveProjectGitHubUseCasePort');
