import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import {
  type ReadCommitFilesInput,
  type ReadCommitFilesResult,
} from '../models/read-commit-files.ts';
import { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ReadCommitFilesService extends Context.Service<
  ReadCommitFilesService,
  {
    readonly execute: (
      input: ReadCommitFilesInput,
    ) => Effect.Effect<
      ReadCommitFilesResult,
      GitIoFailure | CommitNotFoundError,
      WorktreeRead
    >;
  }
>()('@porcelain/changes/ReadCommitFilesService') {
  static readonly layer = Layer.effect(
    ReadCommitFilesService,
    Effect.gen(function* () {
      const commitHistoryReaderCapability = yield* CommitHistoryReader;

      return {
        execute: Effect.fn('ReadCommitFilesService.execute')(function* (
          input: ReadCommitFilesInput,
        ): Effect.fn.Return<
          ReadCommitFilesResult,
          GitIoFailure | CommitNotFoundError,
          WorktreeRead
        > {
          const lookup =
            yield* commitHistoryReaderCapability.readCommitFiles(input);
          if (lookup.kind === 'missing')
            return yield* Effect.fail(new CommitNotFoundError());
          return lookup.files;
        }),
      };
    }),
  );
}
