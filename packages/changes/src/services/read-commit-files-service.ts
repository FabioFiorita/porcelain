import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import type { CommitFiles } from '../models/commit-history.ts';
import type { ReadCommitFilesInput } from '../models/operation-inputs.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ReadCommitFilesService {
  private readonly commitHistoryReader: CommitHistoryReader;

  constructor(commitHistoryReader: CommitHistoryReader) {
    this.commitHistoryReader = commitHistoryReader;
  }

  async execute(
    input: ReadCommitFilesInput,
    signal?: AbortSignal,
  ): Promise<CommitFiles> {
    const files = await this.commitHistoryReader.readCommitFiles(
      input.worktreeId,
      { oid: input.oid, parent: input.parent },
      signal,
    );
    if (files === undefined) throw new CommitNotFoundError();
    return files;
  }
}
