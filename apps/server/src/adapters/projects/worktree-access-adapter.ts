import type { WorktreeCheck } from '@porcelain/projects/models';
import type { InventoryStore, WorktreeAccess } from '@porcelain/projects/ports';
import type { WorktreeDirectoryAdapter } from './worktree-directory-adapter.ts';

export class WorktreeAccessAdapter implements WorktreeAccess {
  private readonly worktreeDirectory: Pick<WorktreeDirectoryAdapter, 'find'>;
  private readonly inventoryStore: Pick<InventoryStore, 'read'>;

  constructor(
    worktreeDirectory: Pick<WorktreeDirectoryAdapter, 'find'>,
    inventoryStore: Pick<InventoryStore, 'read'>,
  ) {
    this.worktreeDirectory = worktreeDirectory;
    this.inventoryStore = inventoryStore;
  }

  async known(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<WorktreeCheck> {
    const { worktree, unlisted } = await this.worktreeDirectory.find(
      worktreeId,
      signal,
    );
    if (worktree) return { outcome: 'found', worktree };
    return { outcome: unlisted ? 'unavailable' : 'missing' };
  }

  async forWriting(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<WorktreeCheck> {
    const check = await this.known(worktreeId, signal);
    if (check.outcome !== 'found') return check;
    const project = this.inventoryStore
      .read()
      .projects.find((entry) => entry.id === check.worktree.projectId);
    return project?.available && check.worktree.available
      ? check
      : { outcome: 'unavailable' };
  }
}
