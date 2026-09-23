import type { GitActionExpectation } from './git-action-expectation.ts';
import type { GitActionIntent } from './git-action-intent.ts';

export type GitActionRun = {
  requestId: string;
  projectId: string;
  worktreeId: string;
  intent: GitActionIntent;
  expected: GitActionExpectation;
};

export type GitActionProgressListener = (line: string) => void;
