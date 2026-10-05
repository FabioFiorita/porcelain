import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import {
  type ListBranchBasesInput,
  type ListBranchBasesResult,
} from '../models/list-branch-bases.ts';
import { BranchRangeReader } from '../ports/branch-range-reader.ts';

export class ListBranchBasesService extends Context.Service<
  ListBranchBasesService,
  {
    readonly execute: (
      input: ListBranchBasesInput,
    ) => Effect.Effect<ListBranchBasesResult, GitIoFailure, WorktreeRead>;
  }
>()('@porcelain/changes/ListBranchBasesService') {
  static readonly layer = Layer.effect(
    ListBranchBasesService,
    Effect.gen(function* () {
      const branchRangeReaderCapability = yield* BranchRangeReader;

      return {
        execute: Effect.fn('ListBranchBasesService.execute')(function* (
          input: ListBranchBasesInput,
        ): Effect.fn.Return<ListBranchBasesResult, GitIoFailure, WorktreeRead> {
          return yield* branchRangeReaderCapability.listBranchBases(input);
        }),
      };
    }),
  );
}
