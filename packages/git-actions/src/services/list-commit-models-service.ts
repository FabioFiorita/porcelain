import { Effect } from 'effect';
import type { ListCommitModelsResult } from '../models/list-commit-models.ts';
import type { CommitModelReader } from '../ports/commit-model-reader.ts';

export class ListCommitModelsService {
  private readonly commitModelReader: CommitModelReader;

  constructor(commitModelReader: CommitModelReader) {
    this.commitModelReader = commitModelReader;
  }

  execute(): Effect.Effect<ListCommitModelsResult, never, never> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.commitModelReader.list();
    });
  }
}
