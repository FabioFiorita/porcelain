import type { WorktreeCheck } from '@porcelain/kernel/models';
import type { WorktreeAccess } from '@porcelain/kernel/ports';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { InventoryStore } from '@porcelain/projects/ports';
import type { GitProjectWorktreeReader } from './git-project-worktree-reader.ts';

export class GitWorktreeAccess implements WorktreeAccess<ListedWorktree> {
  private readonly worktreeDirectory: Pick<GitProjectWorktreeReader, 'find'>;
  private readonly inventoryStore: Pick<InventoryStore, 'read'>;

  constructor(
    worktreeDirectory: Pick<GitProjectWorktreeReader, 'find'>,
    inventoryStore: Pick<InventoryStore, 'read'>,
  ) {
    this.worktreeDirectory = worktreeDirectory;
    this.inventoryStore = inventoryStore;
  }

  async known(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<WorktreeCheck<ListedWorktree>> {
    const { worktree, unlisted } = await this.worktreeDirectory.find(
      worktreeId,
      signal,
    );
    if (worktree) return { kind: 'found', worktree };
    return { kind: unlisted ? 'unavailable' : 'missing' };
  }

  async forWriting(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<WorktreeCheck<ListedWorktree>> {
    const check = await this.known(worktreeId, signal);
    if (check.kind !== 'found') return check;
    const project = this.inventoryStore
      .read()
      .projects.find((entry) => entry.id === check.worktree.projectId);
    return project?.available && check.worktree.available
      ? check
      : { kind: 'unavailable' };
  }
}
