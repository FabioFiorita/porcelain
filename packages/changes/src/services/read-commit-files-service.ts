import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import type {
  ReadCommitFilesInput,
  ReadCommitFilesResult,
} from '../models/read-commit-files.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ReadCommitFilesService {
  private readonly commitHistoryReader: CommitHistoryReader;

  constructor(commitHistoryReader: CommitHistoryReader) {
    this.commitHistoryReader = commitHistoryReader;
  }

  async execute(
    input: ReadCommitFilesInput,
    signal?: AbortSignal,
  ): Promise<ReadCommitFilesResult> {
    const lookup = await this.commitHistoryReader.readCommitFiles(
      input,
      signal,
    );
    if (lookup.kind === 'missing') throw new CommitNotFoundError();
    return lookup.files;
  }
}
