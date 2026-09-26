import {
  corroborates,
  identity,
  readGitdirPointer,
  readHead,
} from '@porcelain/git/discovery';
import type { WorktreeCheck } from '@porcelain/kernel/models';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { WorktreeCatalogStore } from '@porcelain/projects/ports';

export class GitWorktreeAccessReader implements WorktreeAccessReader<ListedWorktree> {
  private readonly catalog: WorktreeCatalogStore;

  constructor(catalog: WorktreeCatalogStore) {
    this.catalog = catalog;
  }

  async known(input: {
    worktreeId: string;
  }): Promise<WorktreeCheck<ListedWorktree>> {
    const entry = this.catalog.find({ worktreeId: input.worktreeId });
    if (!entry) return { kind: 'missing' };
    const current = await this.onDisk(entry.worktree);
    return current
      ? { kind: 'found', worktree: current }
      : { kind: 'unavailable' };
  }

  private async onDisk(
    worktree: ListedWorktree,
  ): Promise<ListedWorktree | undefined> {
    let current: string;
    try {
      current = await identity(worktree.administrativeDirectory);
    } catch {
      return undefined;
    }
    if (current !== worktree.metadataIdentity) return undefined;
    const path = worktree.main
      ? worktree.path
      : await readGitdirPointer(worktree.administrativeDirectory);
    if (!path) return undefined;
    const branch = await readHead(worktree.administrativeDirectory);
    return {
      ...worktree,
      path,
      branch: branch ?? undefined,
      available: await corroborates(path, worktree.administrativeDirectory),
    };
  }
}
