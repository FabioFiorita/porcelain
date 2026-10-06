import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import {
  type FileCommits,
  type ListFileCommitsInput,
} from '../models/list-file-commits.ts';
import { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ListFileCommitsService extends Context.Service<
  ListFileCommitsService,
  {
    readonly execute: (
      input: ListFileCommitsInput,
    ) => Effect.Effect<FileCommits, GitIoFailure, WorktreeRead>;
  }
>()('@porcelain/changes/ListFileCommitsService') {
  static readonly layer = Layer.effect(
    ListFileCommitsService,
    Effect.gen(function* () {
      const commitHistoryReaderCapability = yield* CommitHistoryReader;

      return {
        execute: Effect.fn('ListFileCommitsService.execute')(function* (
          input: ListFileCommitsInput,
        ): Effect.fn.Return<FileCommits, GitIoFailure, WorktreeRead> {
          return yield* commitHistoryReaderCapability.listFileCommits(input);
        }),
      };
    }),
  );
}
