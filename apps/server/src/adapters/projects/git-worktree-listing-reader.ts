import type { DiscoveryResult, GitFactory } from '@porcelain/git/discovery';
import { isRepositoryUnavailable } from '@porcelain/git/discovery';
import type {
  ListableProject,
  ListedWorktree,
  WorktreeListing,
} from '@porcelain/projects/models';
import type { WorktreeListingReader } from '@porcelain/projects/ports';
import type { LaunchLimit } from '../../runtime/launch-limit.ts';
import type { SharedReads } from '../../runtime/shared-reads.ts';

export type WorktreeListingOptions = {
  git: GitFactory;
  sharedReads: Pick<SharedReads<WorktreeListing>, 'run'>;
  launchLimit: Pick<LaunchLimit, 'run'>;
  timeoutMs: number;
  worktreeId: (projectId: string, metadataIdentity: string) => string;
};

export class GitWorktreeListingReader implements WorktreeListingReader {
  private readonly options: WorktreeListingOptions;

  constructor(options: WorktreeListingOptions) {
    this.options = options;
  }

  list(input: ListableProject, signal?: AbortSignal): Promise<WorktreeListing> {
    return this.options.sharedReads.run(
      `worktrees\0${input.id}\0${input.commonDirectory}`,
      async (shared) => this.listNow(input, shared),
      signal,
    );
  }

  private async listNow(
    project: ListableProject,
    signal?: AbortSignal,
  ): Promise<WorktreeListing> {
    let discovered: DiscoveryResult;
    let expiry: AbortSignal | undefined;
    try {
      discovered = await this.options.launchLimit.run(() => {
        expiry = AbortSignal.timeout(this.options.timeoutMs);
        const listing = signal ? AbortSignal.any([signal, expiry]) : expiry;
        return this.options
          .git(project.commonDirectory)
          .listWorktrees(listing, { commonDirectory: project.commonDirectory });
      }, signal);
    } catch (failure) {
      signal?.throwIfAborted();
      if (expiry?.aborted) return { kind: 'timed-out', projectId: project.id };
      if (!isRepositoryUnavailable(failure)) throw failure;
      return { kind: 'unavailable', projectId: project.id };
    }
    const { repository } = discovered;
    const worktrees: ListedWorktree[] = [];
    let unidentified = 0;
    for (const worktree of repository.worktrees) {
      if (!worktree.metadataIdentity) {
        unidentified += 1;
        continue;
      }
      worktrees.push({
        id: this.options.worktreeId(project.id, worktree.metadataIdentity),
        projectId: project.id,
        path: worktree.path,
        branch: worktree.branch ?? undefined,
        main: worktree.main,
        available: worktree.available,
        metadataIdentity: worktree.metadataIdentity,
        administrativeDirectory: worktree.administrativeDirectory,
        commonDirectory: repository.commonDirectory,
        repositoryIdentity: repository.repositoryIdentity,
        repositoryId: repository.repositoryIdentity,
      });
    }
    return {
      kind: 'listed',
      projectId: project.id,
      repositoryIdentity: repository.repositoryIdentity,
      worktrees,
      unidentified,
    };
  }
}
