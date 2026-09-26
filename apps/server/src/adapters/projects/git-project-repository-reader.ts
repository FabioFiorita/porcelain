import type { GitFactory } from '@porcelain/git/discovery';
import { isRepositoryUnavailable } from '@porcelain/git/discovery';
import type {
  DiscoveredProjectRepository,
  RepositoryLocation,
} from '@porcelain/projects/models';
import type { ProjectRepositoryReader } from '@porcelain/projects/ports';

export class GitProjectRepositoryReader implements ProjectRepositoryReader {
  private readonly git: GitFactory;

  constructor(git: GitFactory) {
    this.git = git;
  }

  private async inspect(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<DiscoveredProjectRepository> {
    const { repository } = await this.git(input.path).listWorktrees(signal);
    return {
      commonDirectory: repository.commonDirectory,
      repositoryIdentity: repository.repositoryIdentity,
      worktrees: repository.worktrees.map((worktree) => ({
        path: worktree.path,
        main: worktree.main,
        available: worktree.available,
      })),
    };
  }

  async find(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<DiscoveredProjectRepository | undefined> {
    try {
      return await this.inspect(input, signal);
    } catch (error) {
      signal?.throwIfAborted();
      if (isRepositoryUnavailable(error)) return undefined;
      throw error;
    }
  }

  async readOriginUrl(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    return (await this.git(input.path).readOriginUrl(signal)) ?? undefined;
  }
}
