import type { CommitModel } from '../models/commit-draft.ts';
import type { ListCommitModelsInput } from '../models/commit-draft-operations.ts';
import type { CommitModelReader } from '../ports/commit-model-reader.ts';

export class ListCommitModelsService {
  private readonly commitModelReader: CommitModelReader;

  constructor(commitModelReader: CommitModelReader) {
    this.commitModelReader = commitModelReader;
  }

  execute(
    input: ListCommitModelsInput,
    signal?: AbortSignal,
  ): Promise<CommitModel[]> {
    void input;
    return this.commitModelReader.list(signal);
  }
}
