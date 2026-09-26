import type { FileChange } from '@porcelain/kernel/models';
import type { GitActionOutcome } from './git-action-outcome.ts';
import type {
  GitActionProgressListener,
  GitActionRun,
} from './git-action-run.ts';

export type RunGitActionInput = {
  run: GitActionRun;
  changes: FileChange[];
  onProgress?: GitActionProgressListener | undefined;
};

export type RunGitActionResult = {
  outcome: GitActionOutcome;
  reviewStale: boolean;
};
