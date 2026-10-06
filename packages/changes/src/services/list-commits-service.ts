import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import {
  type ListCommitsInput,
  type ListCommitsResult,
} from '../models/list-commits.ts';
import { CommitHistoryReader } from '../ports/commit-history-reader.ts';

export class ListCommitsService extends Context.Service<
  ListCommitsService,
  {
    readonly execute: (
      input: ListCommitsInput,
    ) => Effect.Effect<ListCommitsResult, GitIoFailure, WorktreeRead>;
  }
>()('@porcelain/changes/ListCommitsService') {
  static readonly layer = Layer.effect(
    ListCommitsService,
    Effect.gen(function* () {
      const commitHistoryReaderCapability = yield* CommitHistoryReader;

      return {
        execute: Effect.fn('ListCommitsService.execute')(function* (
          input: ListCommitsInput,
        ): Effect.fn.Return<ListCommitsResult, GitIoFailure, WorktreeRead> {
          return yield* commitHistoryReaderCapability.listCommits(input);
        }),
      };
    }),
  );
}
