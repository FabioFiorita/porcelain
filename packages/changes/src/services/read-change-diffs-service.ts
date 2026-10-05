import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { IncompleteDiffReadError } from '../errors/incomplete-diff-read-error.ts';
import {
  type ReadChangeDiffsInput,
  type ReadChangeDiffsResult,
} from '../models/read-change-diffs.ts';
import { ChangeDiffReader } from '../ports/change-diff-reader.ts';

export class ReadChangeDiffsService extends Context.Service<
  ReadChangeDiffsService,
  {
    readonly execute: (
      input: ReadChangeDiffsInput,
    ) => Effect.Effect<
      ReadChangeDiffsResult,
      GitIoFailure | IncompleteDiffReadError,
      WorktreeRead
    >;
  }
>()('@porcelain/changes/ReadChangeDiffsService') {
  static readonly layer = Layer.effect(
    ReadChangeDiffsService,
    Effect.gen(function* () {
      const changeDiffReaderCapability = yield* ChangeDiffReader;

      return {
        execute: Effect.fn('ReadChangeDiffsService.execute')(function* (
          input: ReadChangeDiffsInput,
        ): Effect.fn.Return<
          ReadChangeDiffsResult,
          GitIoFailure | IncompleteDiffReadError,
          WorktreeRead
        > {
          const contents = yield* changeDiffReaderCapability.readDiffs(input);
          return yield* Effect.forEach(input.comparisons, (comparison, index) =>
            Effect.gen(function* () {
              const content = contents[index];
              if (content === undefined)
                return yield* Effect.fail(new IncompleteDiffReadError());
              return {
                selection: {
                  scope: comparison.scope,
                  oldPath: comparison.oldPath,
                  newPath: comparison.newPath,
                },
                content,
              };
            }),
          );
        }),
      };
    }),
  );
}
