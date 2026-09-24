import type {
  GitActionRunnerOutcome,
  GitActionRunRequest,
} from '../../src/models/git-action-run.ts';
import type { GitActionRunner } from '../../src/ports/git-action-runner.ts';

export class ScriptedGitActionRunner implements GitActionRunner {
  headOid: string;
  private readonly answer: GitActionRunnerOutcome;
  private readonly headAfterRun: string;
  private readonly progress: readonly string[];

  constructor(script: {
    answer: GitActionRunnerOutcome;
    headOid: string;
    headAfterRun: string;
    progress?: readonly string[];
  }) {
    this.answer = script.answer;
    this.headOid = script.headOid;
    this.headAfterRun = script.headAfterRun;
    this.progress = script.progress ?? [];
  }

  async run(input: GitActionRunRequest): Promise<GitActionRunnerOutcome> {
    this.headOid = this.headAfterRun;
    this.progress.forEach((line) => input.onProgress?.(line));
    return this.answer;
  }
}
