import type { WorktreeCheck } from '@porcelain/kernel/models';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { GitWorktreeCatalogStore } from './git-project-worktree-reader.ts';

export class GitWorktreeAccessReader implements WorktreeAccessReader<ListedWorktree> {
  private readonly worktreeDirectory: Pick<GitWorktreeCatalogStore, 'find'>;

  constructor(worktreeDirectory: Pick<GitWorktreeCatalogStore, 'find'>) {
    this.worktreeDirectory = worktreeDirectory;
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
}
