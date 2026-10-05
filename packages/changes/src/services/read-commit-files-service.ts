import { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import type {
  ReadCommitFilesInput,
  ReadCommitFilesResult,
} from '../models/read-commit-files.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ReadCommitFilesService<E = never> {
  private readonly commitHistoryReader: CommitHistoryReader<E>;

  constructor(commitHistoryReader: CommitHistoryReader<E>) {
    this.commitHistoryReader = commitHistoryReader;
  }

  execute(
    input: ReadCommitFilesInput,
  ): Effect.Effect<
    ReadCommitFilesResult,
    E | CommitNotFoundError,
    WorktreeRead
  > {
    return Effect.gen({ self: this }, function* () {
      const lookup = yield* this.commitHistoryReader.readCommitFiles(input);
      if (lookup.kind === 'missing')
        return yield* Effect.fail(new CommitNotFoundError());
      return lookup.files;
    });
  }
}
