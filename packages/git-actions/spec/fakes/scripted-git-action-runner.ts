import { Effect } from 'effect';
import type {
  GitActionRunnerOutcome,
  GitActionRunRequest,
} from '../../src/models/git-action-run.ts';
import type { GitActionRunner } from '../../src/ports/git-action-runner.ts';

export class ScriptedGitActionRunner implements GitActionRunner {
  private readonly answer: GitActionRunnerOutcome;
  private readonly progress: readonly string[];

  constructor(script: {
    answer: GitActionRunnerOutcome;
    progress?: readonly string[] | undefined;
  }) {
    this.answer = script.answer;
    this.progress = script.progress ?? [];
  }

  run(input: GitActionRunRequest): Effect.Effect<GitActionRunnerOutcome> {
    return Effect.forEach(
      this.progress,
      (line) => input.onProgress?.(line) ?? Effect.void,
    ).pipe(Effect.as(this.answer));
  }
}
