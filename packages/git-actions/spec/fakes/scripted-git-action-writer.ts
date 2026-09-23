import type {
  GitActionOutcome,
  GitActionProgressListener,
  GitActionRun,
} from '../../src/models/index.ts';
import type { GitActionWriter } from '../../src/ports/index.ts';

export class ScriptedGitActionWriter implements GitActionWriter {
  readonly runs: GitActionRun[] = [];
  private readonly answer: (
    run: GitActionRun,
    onProgress: GitActionProgressListener | undefined,
  ) => Promise<GitActionOutcome>;

  constructor(
    answer: (
      run: GitActionRun,
      onProgress: GitActionProgressListener | undefined,
    ) => Promise<GitActionOutcome>,
  ) {
    this.answer = answer;
  }

  async run(
    run: GitActionRun,
    onProgress: GitActionProgressListener | undefined,
  ): Promise<GitActionOutcome> {
    this.runs.push(run);
    return this.answer(run, onProgress);
  }
}
