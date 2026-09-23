import type { GitActionOutcome } from '../models/git-action-outcome.ts';
import type {
  GitActionProgressListener,
  GitActionRun,
} from '../models/git-action-run.ts';

export interface GitActionWriter {
  run(
    run: GitActionRun,
    onProgress: GitActionProgressListener | undefined,
    signal?: AbortSignal,
  ): Promise<GitActionOutcome>;
}
