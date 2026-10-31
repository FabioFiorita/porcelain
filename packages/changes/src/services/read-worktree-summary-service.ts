import type { WorktreeSummary } from '../models/worktree-summary.ts';
import { Context, Effect, Layer } from 'effect';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { ReadWorktreeStatusInput } from '../models/read-worktree-status.ts';
import { ChangeStatusReader } from '../ports/change-status-reader.ts';
export class ReadWorktreeSummaryService extends Context.Service<
  ReadWorktreeSummaryService,
  {
    readonly execute: (
      input: ReadWorktreeStatusInput,
    ) => Effect.Effect<WorktreeSummary, GitIoFailure, WorktreeRead>;
  }
>()('@porcelain/changes/ReadWorktreeSummaryService') {
  static readonly layer = Layer.effect(
    ReadWorktreeSummaryService,
    Effect.gen(function* () {
      const reader = yield* ChangeStatusReader;
      return {
        execute: Effect.fn('ReadWorktreeSummaryService.execute')((input) =>
          reader.readSummary(input),
        ),
      };
    }),
  );
}
