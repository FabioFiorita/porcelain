import type {
  WorktreePathsRead,
  WorktreePathsReadInput,
} from '@porcelain/files/models';
import type { WorktreePathsReader } from '@porcelain/files/ports';
import {
  InspectionLimitError,
  listTrackedPaths,
} from '@porcelain/git/inspection';
import {
  listedWorktree,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export class GitWorktreePathsReader implements WorktreePathsReader {
  private readonly worktrees: ListedWorktrees;

  constructor(worktrees: ListedWorktrees) {
    this.worktrees = worktrees;
  }

  async read(
    input: WorktreePathsReadInput,
    signal?: AbortSignal,
  ): Promise<WorktreePathsRead> {
    const checkout = await listedWorktree(
      this.worktrees,
      input.worktreeId,
      signal,
    );
    try {
      const listed = await listTrackedPaths(checkout.path, signal);
      return listed.complete
        ? { kind: 'listed', paths: listed.paths }
        : { kind: 'too-large' };
    } catch (error) {
      if (error instanceof InspectionLimitError) return { kind: 'too-large' };
      throw error;
    }
  }
}
