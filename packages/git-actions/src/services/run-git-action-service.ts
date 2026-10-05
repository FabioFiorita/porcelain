import { Effect } from 'effect';
import type { WorktreeRead, WorktreeWrite } from '@porcelain/effects/worktree';
import type { FileChange } from '@porcelain/kernel/models';
import type { GitActionOutcome } from '../models/git-action-outcome.ts';
import type {
  GitActionRun,
  GitActionRunnerOutcome,
} from '../models/git-action-run.ts';
import type {
  RunGitActionInput,
  RunGitActionResult,
} from '../models/run-git-action.ts';
import type { GitActionRunner } from '../ports/git-action-runner.ts';
import { expectsWholeChangeList } from '../rules/expects-whole-change-list.ts';
import { targetMatchesExpectation } from '../rules/target-matches-expectation.ts';

export class RunGitActionService<E = never> {
  private readonly gitActionRunner: GitActionRunner<E>;

  constructor(gitActionRunner: GitActionRunner<E>) {
    this.gitActionRunner = gitActionRunner;
  }

  execute(
    input: RunGitActionInput,
  ): Effect.Effect<RunGitActionResult, E, WorktreeRead | WorktreeWrite> {
    return Effect.gen({ self: this }, function* () {
      const { run } = input;
      const outcome = this.targetMatches(run, input.changes)
        ? this.outcome(
            yield* this.gitActionRunner.run({
              run,
              onProgress: input.onProgress,
            }),
          )
        : this.changedSinceLooked();
      return {
        outcome,
        reviewStale:
          (run.intent.action === 'commit' || run.intent.action === 'amend') &&
          outcome.state === 'succeeded',
      };
    });
  }

  private targetMatches(
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

  private outcome(ran: GitActionRunnerOutcome): GitActionOutcome {
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

  private changedSinceLooked(): GitActionOutcome {
    return {
      state: 'rejected',
      reason: 'CHANGED_SINCE_LOOKED',
      refreshRequired: false,
    };
  }
}
