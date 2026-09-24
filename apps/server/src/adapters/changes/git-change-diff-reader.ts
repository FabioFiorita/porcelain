import type { ChangeDiffContent } from '@porcelain/changes/models';
import type { ChangeDiffReader } from '@porcelain/changes/ports';
import type { TrackedComparison } from '@porcelain/kernel/models';
import { toGitChange } from './git-comparisons.ts';
import type { InspectionCheckouts } from './inspection-checkouts.ts';

export class GitChangeDiffReader implements ChangeDiffReader {
  private readonly checkouts: InspectionCheckouts;

  constructor(checkouts: InspectionCheckouts) {
    this.checkouts = checkouts;
  }

  async readDiffs(
    worktreeId: string,
    comparisons: readonly TrackedComparison[],
    signal?: AbortSignal,
  ): Promise<ChangeDiffContent[]> {
    const { git } = await this.checkouts.open(worktreeId, signal);
    return git.readDiffs(comparisons.map(toGitChange), signal);
  }
}
