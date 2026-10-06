import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import {
  type ReadBranchDetailsInput,
  type ReadBranchDetailsResult,
} from '../models/read-branch-details.ts';
import { ChangeStatusReader } from '../ports/change-status-reader.ts';

export class ReadBranchDetailsService extends Context.Service<
  ReadBranchDetailsService,
  {
    readonly execute: (
      input: ReadBranchDetailsInput,
    ) => Effect.Effect<ReadBranchDetailsResult, GitIoFailure, WorktreeRead>;
  }
>()('@porcelain/changes/ReadBranchDetailsService') {
  static readonly layer = Layer.effect(
    ReadBranchDetailsService,
    Effect.gen(function* () {
      const changeStatusReaderCapability = yield* ChangeStatusReader;

      return {
        execute: Effect.fn('ReadBranchDetailsService.execute')(function* (
          input: ReadBranchDetailsInput,
        ): Effect.fn.Return<
          ReadBranchDetailsResult,
          GitIoFailure,
          WorktreeRead
        > {
          return yield* changeStatusReaderCapability.readBranchDetails({
            worktreeId: input.worktreeId,
            branchName: input.branch?.name,
            headOid: input.headOid,
          });
        }),
      };
    }),
  );
}
