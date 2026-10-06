import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import { IncompleteDiffReadError } from '../errors/incomplete-diff-read-error.ts';
import { type ChangeDiffContent } from '../models/change-diff.ts';
import {
  type ReadBranchDiffsInput,
  type ReadBranchDiffsResult,
} from '../models/read-branch-diffs.ts';
import { BranchRangeReader } from '../ports/branch-range-reader.ts';

const OVER_LIMIT: ChangeDiffContent = { kind: 'omitted', reason: 'size-limit' };

export class ReadBranchDiffsService extends Context.Service<
  ReadBranchDiffsService,
  {
    readonly execute: (
      input: ReadBranchDiffsInput,
    ) => Effect.Effect<
      ReadBranchDiffsResult,
      GitIoFailure | CommitNotFoundError | IncompleteDiffReadError,
      WorktreeRead
    >;
  }
>()('@porcelain/changes/ReadBranchDiffsService') {
  static readonly layer = Layer.effect(
    ReadBranchDiffsService,
    Effect.gen(function* () {
      const branchRangeReaderCapability = yield* BranchRangeReader;

      return {
        execute: Effect.fn('ReadBranchDiffsService.execute')(function* (
          input: ReadBranchDiffsInput,
        ): Effect.fn.Return<
          ReadBranchDiffsResult,
          GitIoFailure | CommitNotFoundError | IncompleteDiffReadError,
          WorktreeRead
        > {
          const read = yield* branchRangeReaderCapability.readBranchPatches({
            worktreeId: input.worktreeId,
            baseOid: input.baseOid,
            headOid: input.headOid,
            paths: input.paths,
          });
          if (read.kind === 'missing')
            return yield* Effect.fail(new CommitNotFoundError());
          const patches = new Map(
            read.kind === 'within-limit'
              ? read.patches.map((patch) => [
                  patch.paths.join('\0'),
                  patch.content,
                ])
              : [],
          );
          const diffs = yield* Effect.forEach(input.paths, (paths) =>
            Effect.gen(function* () {
              if (read.kind === 'over-limit')
                return { paths: [...paths], content: OVER_LIMIT };
              const content = patches.get(paths.join('\0'));
              if (content === undefined)
                return yield* Effect.fail(new IncompleteDiffReadError());
              return { paths: [...paths], content };
            }),
          );
          return { diffs };
        }),
      };
    }),
  );
}
