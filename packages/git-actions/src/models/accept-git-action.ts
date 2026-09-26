import type { GitActionExpectation } from './git-action-expectation.ts';
import type { GitActionIntent } from './git-action-intent.ts';
import type { GitActionReceiptView } from './git-action-receipt-view.ts';
import type { GitActionRun } from './git-action-run.ts';
import type { GitActionScope } from './git-action-scope.ts';

export type AcceptGitActionInput = GitActionScope & {
  requestId: string;
  intent: GitActionIntent;
  expected: GitActionExpectation;
};

export type AcceptGitActionResult =
  | { kind: 'accepted'; receipt: GitActionReceiptView; run: GitActionRun }
  | { kind: 'repeated'; receipt: GitActionReceiptView };
