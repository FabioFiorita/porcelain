import type { WorktreeCheck } from '@porcelain/kernel/models';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type {
  ListedWorktree,
  RegisteredProject,
} from '@porcelain/projects/models';
import type { InventoryStore } from '@porcelain/projects/ports';
import type { GitWorktreeCatalogStore } from './git-project-worktree-reader.ts';

function worktreeIsWritable(
  worktree: ListedWorktree,
  project: RegisteredProject | undefined,
): boolean {
  return project?.available === true && worktree.available;
}

export class GitWorktreeAccessReader implements WorktreeAccessReader<ListedWorktree> {
  private readonly worktreeDirectory: Pick<GitWorktreeCatalogStore, 'find'>;
  private readonly inventory: Pick<InventoryStore, 'read'>;

  constructor(
    worktreeDirectory: Pick<GitWorktreeCatalogStore, 'find'>,
    inventory: Pick<InventoryStore, 'read'>,
  ) {
    this.worktreeDirectory = worktreeDirectory;
    this.inventory = inventory;
  }

  async known(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<WorktreeCheck<ListedWorktree>> {
    const { worktree, unlisted } = await this.worktreeDirectory.find(
      input.worktreeId,
      signal,
    );
    if (worktree) return { kind: 'found', worktree };
    return { kind: unlisted ? 'unavailable' : 'missing' };
  }

  async forWriting(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<WorktreeCheck<ListedWorktree>> {
    const check = await this.known(input, signal);
    if (check.kind !== 'found') return check;
    const project = this.inventory
      .read()
      .projects.find((entry) => entry.id === check.worktree.projectId);
    return worktreeIsWritable(check.worktree, project)
      ? check
      : { kind: 'unavailable' };
  }
}
