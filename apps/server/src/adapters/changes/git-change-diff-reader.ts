import type {
  ChangeDiffContent,
  ReadChangeDiffsInput,
} from '@porcelain/changes/models';
import type { ChangeDiffReader } from '@porcelain/changes/ports';
import { toGitChange } from './git-comparisons.ts';
import type { OpenInspection } from './inspection-checkouts.ts';

export class GitChangeDiffReader implements ChangeDiffReader {
  private readonly open: OpenInspection;

  constructor(open: OpenInspection) {
    this.open = open;
  }

  async readDiffs(
    input: ReadChangeDiffsInput,
    signal?: AbortSignal,
  ): Promise<ChangeDiffContent[]> {
    const { git } = await this.open(input.worktreeId, signal);
    return git.readDiffs(input.comparisons.map(toGitChange), signal);
  }
}
