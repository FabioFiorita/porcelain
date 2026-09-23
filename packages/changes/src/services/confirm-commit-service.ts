import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import type { ReadCommitFilesInput } from '../models/operation-inputs.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ConfirmCommitService {
  private readonly commitHistoryReader: CommitHistoryReader;

  constructor(commitHistoryReader: CommitHistoryReader) {
    this.commitHistoryReader = commitHistoryReader;
  }

  async execute(
    input: ReadCommitFilesInput,
    signal?: AbortSignal,
  ): Promise<void> {
    const files = await this.commitHistoryReader.readCommitFiles(
      input.worktreeId,
      { oid: input.oid, parent: input.parent },
      signal,
    );
    if (files === undefined) throw new CommitNotFoundError();
  }
}
