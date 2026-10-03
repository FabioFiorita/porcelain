import type {
  GitActionRunnerOutcome,
  GitActionRunRequest,
} from '../models/git-action-run.ts';

export interface GitActionRunner {
  run(
    input: GitActionRunRequest,
    signal?: AbortSignal,
  ): Promise<GitActionRunnerOutcome>;
}
