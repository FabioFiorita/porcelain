import type { ListCommitModelsResult } from '../models/list-commit-models.ts';
import type { CommitModelReader } from '../ports/commit-model-reader.ts';

export class ListCommitModelsService {
  private readonly commitModelReader: CommitModelReader;

  constructor(commitModelReader: CommitModelReader) {
    this.commitModelReader = commitModelReader;
  }

  execute(): Promise<ListCommitModelsResult> {
    return this.commitModelReader.list();
  }
}
