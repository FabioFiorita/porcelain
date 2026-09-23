import { RepositoryIdentityMismatchError } from '@porcelain/git/discovery';
import {
  ProjectNotFoundError,
  WorktreeNotFoundError,
} from '@porcelain/projects/errors';
import type { Worktree } from '@porcelain/projects/models';
import type { InventoryStore, WorktreeAccess } from '@porcelain/projects/ports';
import type { WorktreeDirectoryAdapter } from './worktree-directory-adapter.ts';

export class WorktreeAccessAdapter implements WorktreeAccess {
  private readonly worktreeDirectory: Pick<WorktreeDirectoryAdapter, 'find'>;
  private readonly inventoryStore: InventoryStore;

  constructor(
    worktreeDirectory: Pick<WorktreeDirectoryAdapter, 'find'>,
    inventoryStore: InventoryStore,
  ) {
    this.worktreeDirectory = worktreeDirectory;
    this.inventoryStore = inventoryStore;
  }

  async known(worktreeId: string, signal?: AbortSignal): Promise<Worktree> {
    const { worktree, unlisted } = await this.worktreeDirectory.find(
      worktreeId,
      signal,
    );
    if (worktree) return worktree;
    if (unlisted) throw new RepositoryIdentityMismatchError();
    throw new WorktreeNotFoundError();
  }

  async forWriting(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<Worktree> {
    const worktree = await this.known(worktreeId, signal);
    const project = this.inventoryStore
      .read()
      .projects.find((entry) => entry.id === worktree.projectId);
    if (!project?.available || !worktree.available)
      throw new RepositoryIdentityMismatchError();
    return worktree;
  }

  reachable(worktreeId: string, signal?: AbortSignal): Promise<Worktree> {
    return this.forWriting(worktreeId, signal);
  }

  async inProject(
    projectId: string,
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<Worktree> {
    if (
      !this.inventoryStore
        .read()
        .projects.some((project) => project.id === projectId)
    )
      throw new ProjectNotFoundError();
    const worktree = await this.forWriting(worktreeId, signal);
    if (worktree.projectId !== projectId) throw new WorktreeNotFoundError();
    return worktree;
  }
}
