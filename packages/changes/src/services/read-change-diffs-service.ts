import { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import { IncompleteDiffReadError } from '../errors/incomplete-diff-read-error.ts';
import type {
  ReadChangeDiffsInput,
  ReadChangeDiffsResult,
} from '../models/read-change-diffs.ts';
import type { ChangeDiffReader } from '../ports/change-diff-reader.ts';

export class ReadChangeDiffsService<E = never> {
  private readonly changeDiffReader: ChangeDiffReader<E>;

  constructor(changeDiffReader: ChangeDiffReader<E>) {
    this.changeDiffReader = changeDiffReader;
  }

  execute(
    input: ReadChangeDiffsInput,
  ): Effect.Effect<
    ReadChangeDiffsResult,
    E | IncompleteDiffReadError,
    WorktreeRead
  > {
    return Effect.gen({ self: this }, function* () {
      const contents = yield* this.changeDiffReader.readDiffs(input);
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
    });
  }
}
