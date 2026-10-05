import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import { type CheckCommitInput } from '../models/check-commit.ts';
import { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class CheckCommitService extends Context.Service<
  CheckCommitService,
  {
    readonly execute: (
      input: CheckCommitInput,
    ) => Effect.Effect<void, GitIoFailure | CommitNotFoundError, WorktreeRead>;
  }
>()('@porcelain/changes/CheckCommitService') {
  static readonly layer = Layer.effect(
    CheckCommitService,
    Effect.gen(function* () {
      const commitHistoryReaderCapability = yield* CommitHistoryReader;

      return {
        execute: Effect.fn('CheckCommitService.execute')(function* (
          input: CheckCommitInput,
        ): Effect.fn.Return<
          void,
          GitIoFailure | CommitNotFoundError,
          WorktreeRead
        > {
          const lookup =
            yield* commitHistoryReaderCapability.readCommitFiles(input);
          if (lookup.kind === 'missing')
            return yield* Effect.fail(new CommitNotFoundError());
        }),
      };
    }),
  );
}
