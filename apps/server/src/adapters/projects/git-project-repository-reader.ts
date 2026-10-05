import type { Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import type { GitFactory } from '@porcelain/git/discovery';
import { isRepositoryUnavailable } from '@porcelain/git/errors';
import type {
  ProjectRepository,
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
  ): Promise<ProjectRepository> {
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

  find(
    input: RepositoryLocation,
  ): Effect.Effect<ProjectRepository | undefined> {
    return nativeOperation((signal) => this.findNative(input, signal));
  }

  private async findNative(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<ProjectRepository | undefined> {
    try {
      return await this.inspect(input, signal);
    } catch (error) {
      signal?.throwIfAborted();
      if (isRepositoryUnavailable(error)) return undefined;
      throw error;
    }
  }

  readOriginUrl(input: RepositoryLocation): Effect.Effect<string | undefined> {
    return nativeOperation((signal) => this.readOriginUrlNative(input, signal));
  }

  private async readOriginUrlNative(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    return (await this.git(input.path).readOriginUrl(signal)) ?? undefined;
  }
}
