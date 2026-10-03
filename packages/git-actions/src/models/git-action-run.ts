import type { GitActionExpectation } from './git-action-expectation.ts';
import type { GitActionIntent } from './git-action-intent.ts';
import type { GitActionOutcome } from './git-action-outcome.ts';
import type { GitActionReason } from './git-action-reason.ts';

export type GitActionTarget =
  | { kind: 'unchecked' }
  | { kind: 'checked'; paths: string[] | undefined };

export type GitActionRun = {
  requestId: string;
  projectId: string;
  worktreeId: string;
  intent: GitActionIntent;
  expected: GitActionExpectation;
  target: GitActionTarget;
};

export type GitActionProgressListener = (line: string) => void;

export type GitActionRunRequest = {
  run: GitActionRun;
  onProgress?: GitActionProgressListener | undefined;
};

export type GitActionRunnerOutcome =
  | { kind: 'finished'; outcome: GitActionOutcome }
  | { kind: 'refused'; reason: GitActionReason; detail: string | undefined }
  | { kind: 'timed-out' };
