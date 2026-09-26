import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import type { CheckCommitInput } from '../models/check-commit.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class CheckCommitService {
  private readonly commitHistoryReader: CommitHistoryReader;

  constructor(commitHistoryReader: CommitHistoryReader) {
    this.commitHistoryReader = commitHistoryReader;
  }

  async execute(input: CheckCommitInput, signal?: AbortSignal): Promise<void> {
    const lookup = await this.commitHistoryReader.readCommitFiles(
      input,
      signal,
    );
    if (lookup.kind === 'missing') throw new CommitNotFoundError();
  }
}
