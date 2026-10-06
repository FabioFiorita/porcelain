import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import {
  type ReadWorktreeStatusInput,
  type ReadWorktreeStatusResult,
} from '../models/read-worktree-status.ts';
import { ChangeStatusReader } from '../ports/change-status-reader.ts';

export class ReadWorktreeStatusService extends Context.Service<
  ReadWorktreeStatusService,
  {
    readonly execute: (
      input: ReadWorktreeStatusInput,
    ) => Effect.Effect<ReadWorktreeStatusResult, GitIoFailure, WorktreeRead>;
  }
>()('@porcelain/changes/ReadWorktreeStatusService') {
  static readonly layer = Layer.effect(
    ReadWorktreeStatusService,
    Effect.gen(function* () {
      const changeStatusReaderCapability = yield* ChangeStatusReader;

      return {
        execute: Effect.fn('ReadWorktreeStatusService.execute')(function* (
          input: ReadWorktreeStatusInput,
        ): Effect.fn.Return<
          ReadWorktreeStatusResult,
          GitIoFailure,
          WorktreeRead
        > {
          return yield* changeStatusReaderCapability.readStatus(input);
        }),
      };
    }),
  );
}
