import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type {
  ListCommitsInput,
  ListCommitsResult,
} from '../models/list-commits.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ListCommitsService<E = never> {
  private readonly commitHistoryReader: CommitHistoryReader<E>;

  constructor(commitHistoryReader: CommitHistoryReader<E>) {
    this.commitHistoryReader = commitHistoryReader;
  }

  execute(
    input: ListCommitsInput,
  ): Effect.Effect<ListCommitsResult, E, WorktreeRead> {
    return this.commitHistoryReader.listCommits(input);
  }
}
