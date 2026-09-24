import type {
  ListCommitsInput,
  ListCommitsResult,
} from '../models/list-commits.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ListCommitsService {
  private readonly commitHistoryReader: CommitHistoryReader;

  constructor(commitHistoryReader: CommitHistoryReader) {
    this.commitHistoryReader = commitHistoryReader;
  }

  execute(
    input: ListCommitsInput,
    signal?: AbortSignal,
  ): Promise<ListCommitsResult> {
    return this.commitHistoryReader.listCommits(input, signal);
  }
}
