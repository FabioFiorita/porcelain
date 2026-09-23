import type { CommitPage } from '../models/commit-history.ts';
import type { ListCommitsInput } from '../models/operation-inputs.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ListCommitsService {
  private readonly commitHistoryReader: CommitHistoryReader;

  constructor(commitHistoryReader: CommitHistoryReader) {
    this.commitHistoryReader = commitHistoryReader;
  }

  execute(input: ListCommitsInput, signal?: AbortSignal): Promise<CommitPage> {
    const { worktreeId, limit, after, tip } = input;
    return this.commitHistoryReader.listCommits(
      worktreeId,
      { limit, after, tip },
      signal,
    );
  }
}
