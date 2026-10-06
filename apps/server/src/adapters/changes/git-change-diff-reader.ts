import { type Effect } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { readGit } from '../../runtime/git-io.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import {
  type ChangeDiffContent,
  type ReadChangeDiffsInput,
} from '@porcelain/changes/models';
import { type ChangeDiffReader } from '@porcelain/changes/ports';
import { toGitChange } from './git-comparisons.ts';
import { type OpenInspection } from './inspection-checkouts.ts';

export class GitChangeDiffReader implements ChangeDiffReader {
  private readonly open: OpenInspection;

  constructor(open: OpenInspection) {
    this.open = open;
  }

  readDiffs(
    input: ReadChangeDiffsInput,
  ): Effect.Effect<ChangeDiffContent[], GitIoFailure, WorktreeRead> {
    return readGit(input.worktreeId, (signal) =>
      this.readDiffsNative(input, signal),
    );
  }

  private async readDiffsNative(
    input: ReadChangeDiffsInput,
    signal?: AbortSignal,
  ): Promise<ChangeDiffContent[]> {
    const { git } = await this.open(input.worktreeId, signal);
    return git.readDiffs(input.comparisons.map(toGitChange), signal);
  }
}
