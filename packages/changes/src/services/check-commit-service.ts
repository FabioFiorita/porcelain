import { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import type { CheckCommitInput } from '../models/check-commit.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class CheckCommitService<E = never> {
  private readonly commitHistoryReader: CommitHistoryReader<E>;

  constructor(commitHistoryReader: CommitHistoryReader<E>) {
    this.commitHistoryReader = commitHistoryReader;
  }

  execute(
    input: CheckCommitInput,
  ): Effect.Effect<void, E | CommitNotFoundError, WorktreeRead> {
    return Effect.gen({ self: this }, function* () {
      const lookup = yield* this.commitHistoryReader.readCommitFiles(input);
      if (lookup.kind === 'missing')
        return yield* Effect.fail(new CommitNotFoundError());
    });
  }
}
