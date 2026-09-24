import type { CommitModel } from '../models/commit-draft.ts';
import type { CommitModelReader } from '../ports/commit-model-reader.ts';

export class ListCommitModelsService {
  private readonly commitModelReader: CommitModelReader;

  constructor(commitModelReader: CommitModelReader) {
    this.commitModelReader = commitModelReader;
  }

  execute(signal?: AbortSignal): Promise<CommitModel[]> {
    return this.commitModelReader.list(signal);
  }
}
