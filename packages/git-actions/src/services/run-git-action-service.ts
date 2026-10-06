import { type GitIoFailure } from '@porcelain/git/errors';
import { Effect, Context, Layer } from 'effect';
import {
  type WorktreeRead,
  type WorktreeWrite,
} from '@porcelain/effects/worktree';
import { type FileChange } from '@porcelain/kernel/models';
import { type GitActionOutcome } from '../models/git-action-outcome.ts';
import {
  type GitActionRun,
  type GitActionRunnerOutcome,
} from '../models/git-action-run.ts';
import {
  type RunGitActionInput,
  type RunGitActionResult,
} from '../models/run-git-action.ts';
import { GitActionRunner } from '../ports/git-action-runner.ts';
import { expectsWholeChangeList } from '../rules/expects-whole-change-list.ts';
import { targetMatchesExpectation } from '../rules/target-matches-expectation.ts';

export class RunGitActionService extends Context.Service<
  RunGitActionService,
  {
    readonly execute: (
      input: RunGitActionInput,
    ) => Effect.Effect<
      RunGitActionResult,
      GitIoFailure,
      WorktreeRead | WorktreeWrite
    >;
  }
>()('@porcelain/git-actions/RunGitActionService') {
  static readonly layer = Layer.effect(
    RunGitActionService,
    Effect.gen(function* () {
      const gitActionRunnerCapability = yield* GitActionRunner;
      function operationTargetMatches(
        run: GitActionRun,
        changes: readonly FileChange[],
      ): boolean {
        const files = run.expected.files;
        return (
          files === undefined ||
          targetMatchesExpectation(
            files,
            changes,
            expectsWholeChangeList(run.intent, run.expected),
          )
        );
      }
      function operationOutcome(ran: GitActionRunnerOutcome): GitActionOutcome {
        switch (ran.kind) {
          case 'finished':
            return ran.outcome;
          case 'refused':
            return {
              state: 'rejected',
              reason: ran.reason,
              message: ran.detail,
              refreshRequired: false,
            };
          case 'timed-out':
            return {
              state: 'interrupted',
              reason: 'DEADLINE_EXCEEDED',
              refreshRequired: false,
            };
        }
      }
      function operationChangedSinceLooked(): GitActionOutcome {
        return {
          state: 'rejected',
          reason: 'CHANGED_SINCE_LOOKED',
          refreshRequired: false,
        };
      }
      return {
        execute: Effect.fn('RunGitActionService.execute')(function* (
          input: RunGitActionInput,
        ): Effect.fn.Return<
          RunGitActionResult,
          GitIoFailure,
          WorktreeRead | WorktreeWrite
        > {
          const { run } = input;
          const outcome = operationTargetMatches(run, input.changes)
            ? operationOutcome(
                yield* gitActionRunnerCapability.run({
                  run,
                  onProgress: input.onProgress,
                }),
              )
            : operationChangedSinceLooked();
          return {
            outcome,
            reviewStale:
              (run.intent.action === 'commit' ||
                run.intent.action === 'amend') &&
              outcome.state === 'succeeded',
          };
        }),
      };
    }),
  );
}
