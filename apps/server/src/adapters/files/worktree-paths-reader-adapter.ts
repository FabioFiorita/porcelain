import type { WorktreePathsRead } from '@porcelain/files/models';
import type { WorktreePathsReader } from '@porcelain/files/ports';
import {
  InspectionLimitError,
  listTrackedPaths,
} from '@porcelain/git/inspection';
import {
  knownWorktree,
  type KnownWorktrees,
} from '../projects/checkout-session.ts';

export class WorktreePathsReaderAdapter implements WorktreePathsReader {
  private readonly worktrees: KnownWorktrees;

  constructor(worktrees: KnownWorktrees) {
    this.worktrees = worktrees;
  }

  async read(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<WorktreePathsRead> {
    const checkout = await knownWorktree(this.worktrees, worktreeId, signal);
    try {
      const listed = await listTrackedPaths(checkout.path, signal);
      return listed.complete
        ? { kind: 'paths', paths: listed.paths }
        : { kind: 'too-large' };
    } catch (error) {
      if (error instanceof InspectionLimitError) return { kind: 'too-large' };
      throw error;
    }
  }
}
