import type {
  FileCommits,
  ListFileCommitsInput,
} from '../models/list-file-commits.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ListFileCommitsService {
  private readonly commitHistoryReader: CommitHistoryReader;

  constructor(commitHistoryReader: CommitHistoryReader) {
    this.commitHistoryReader = commitHistoryReader;
  }

  execute(
    input: ListFileCommitsInput,
    signal?: AbortSignal,
  ): Promise<FileCommits> {
    return this.commitHistoryReader.listFileCommits(input, signal);
  }
}
