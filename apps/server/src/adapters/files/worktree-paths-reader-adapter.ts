import type { WorktreePathsRead } from '@porcelain/files/models';
import type { WorktreePathsReader } from '@porcelain/files/ports';
import {
  InspectionLimitError,
  listTrackedPaths,
} from '@porcelain/git/inspection';
import type { WorktreeCheckouts } from './worktree-checkouts.ts';

export class WorktreePathsReaderAdapter implements WorktreePathsReader {
  private readonly worktreeCheckouts: WorktreeCheckouts;

  constructor(worktreeCheckouts: WorktreeCheckouts) {
    this.worktreeCheckouts = worktreeCheckouts;
  }

  async read(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<WorktreePathsRead> {
    const checkout = await this.worktreeCheckouts.known(worktreeId, signal);
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
