import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { type ChangeDiffContent } from '../models/change-diff.ts';
import {
  type ReadCommitDiffsInput,
  type ReadCommitDiffsResult,
} from '../models/read-commit-diffs.ts';
import { CommitHistoryReader } from '../ports/commit-history-reader.ts';

const UNTOUCHED: ChangeDiffContent = { kind: 'metadata-only', patch: '' };
const OVER_LIMIT: ChangeDiffContent = { kind: 'omitted', reason: 'size-limit' };

export class ReadCommitDiffsService extends Context.Service<
  ReadCommitDiffsService,
  {
    readonly execute: (
      input: ReadCommitDiffsInput,
    ) => Effect.Effect<ReadCommitDiffsResult, GitIoFailure, WorktreeRead>;
  }
>()('@porcelain/changes/ReadCommitDiffsService') {
  static readonly layer = Layer.effect(
    ReadCommitDiffsService,
    Effect.gen(function* () {
      const commitHistoryReaderCapability = yield* CommitHistoryReader;

      return {
        execute: Effect.fn('ReadCommitDiffsService.execute')(function* (
          input: ReadCommitDiffsInput,
        ): Effect.fn.Return<ReadCommitDiffsResult, GitIoFailure, WorktreeRead> {
          const read = yield* commitHistoryReaderCapability.readCommitPatches({
            worktreeId: input.worktreeId,
            oid: input.oid,
            parent: input.parent,
            paths: input.paths,
          });
          const patches = new Map(
            read.kind === 'within-limit'
              ? read.patches.map((patch) => [
                  patch.paths.join('\0'),
                  patch.content,
                ])
              : [],
          );
          return {
            commitOid: input.oid,
            diffs: input.paths.map((paths) => ({
              paths: [...paths],
              content:
                read.kind === 'over-limit'
                  ? OVER_LIMIT
                  : (patches.get(paths.join('\0')) ?? UNTOUCHED),
            })),
          };
        }),
      };
    }),
  );
}
