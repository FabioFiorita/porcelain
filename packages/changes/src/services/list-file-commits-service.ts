import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type {
  FileCommits,
  ListFileCommitsInput,
} from '../models/list-file-commits.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ListFileCommitsService<E = never> {
  private readonly commitHistoryReader: CommitHistoryReader<E>;

  constructor(commitHistoryReader: CommitHistoryReader<E>) {
    this.commitHistoryReader = commitHistoryReader;
  }

  execute(
    input: ListFileCommitsInput,
  ): Effect.Effect<FileCommits, E, WorktreeRead> {
    return this.commitHistoryReader.listFileCommits(input);
  }
}
