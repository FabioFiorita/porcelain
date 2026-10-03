import type { Clock } from '@porcelain/kernel/ports';
import { DiscardExpectationMismatchError } from '../errors/discard-expectation-mismatch-error.ts';
import { DuplicateExpectedFileError } from '../errors/duplicate-expected-file-error.ts';
import { EmptyCommitSelectionError } from '../errors/empty-commit-selection-error.ts';
import { ExpectedFilesMismatchError } from '../errors/expected-files-mismatch-error.ts';
import { GitActionReceiptMismatchError } from '../errors/git-action-receipt-mismatch-error.ts';
import { InvalidHunkRangeError } from '../errors/invalid-hunk-range-error.ts';
import { MergeExpectationMismatchError } from '../errors/merge-expectation-mismatch-error.ts';
import { MissingExpectedFilesError } from '../errors/missing-expected-files-error.ts';
import { MissingUpstreamExpectationError } from '../errors/missing-upstream-expectation-error.ts';
import type {
  AcceptGitActionInput,
  AcceptGitActionResult,
} from '../models/accept-git-action.ts';
import type { GitActionProblem } from '../models/git-action-problem.ts';
import type { GitActionReceipt } from '../models/git-action-receipt.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionProblem } from '../rules/git-action-problem.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';
import { gitActionTarget } from '../rules/git-action-target.ts';
import { sameGitActionRequest } from '../rules/same-git-action-request.ts';

export class AcceptGitActionService {
  private readonly gitActionReceipts: GitActionReceiptStore;
  private readonly clock: Clock;

  constructor(gitActionReceipts: GitActionReceiptStore, clock: Clock) {
    this.gitActionReceipts = gitActionReceipts;
    this.clock = clock;
  }

  execute(input: AcceptGitActionInput): AcceptGitActionResult {
    const { intent, expected } = input;
    const problem = gitActionProblem(intent, expected);
    if (problem) throw this.failure(problem);
    const previous = this.gitActionReceipts.read({
      requestId: input.requestId,
    });
    if (previous) {
      if (!sameGitActionRequest(previous, input))
        throw new GitActionReceiptMismatchError();
      return { kind: 'repeated', receipt: gitActionReceiptView(previous) };
    }
    const receipt: GitActionReceipt = {
      requestId: input.requestId,
      projectId: input.projectId,
      worktreeId: input.worktreeId,
      action: intent.action,
      intent,
      expected,
      state: 'running',
      progress: [],
      refreshRequired: false,
      acceptedAt: this.clock.now(),
    };
    this.gitActionReceipts.insert(receipt);
    return {
      kind: 'accepted',
      receipt: gitActionReceiptView(receipt),
      run: {
        requestId: input.requestId,
        projectId: input.projectId,
        worktreeId: input.worktreeId,
        intent,
        expected,
        target: gitActionTarget(intent, expected),
      },
    };
  }

  private failure(problem: GitActionProblem): Error {
    switch (problem.kind) {
      case 'hunk-range':
        return new InvalidHunkRangeError();
      case 'duplicate-expected-file':
        return new DuplicateExpectedFileError();
      case 'merge-expectation':
        return new MergeExpectationMismatchError();
      case 'empty-commit-selection':
        return new EmptyCommitSelectionError();
      case 'missing-expected-files':
        return new MissingExpectedFilesError();
      case 'expected-files-mismatch':
        return new ExpectedFilesMismatchError();
      case 'discard-expectation':
        return new DiscardExpectationMismatchError();
      case 'missing-upstream-expectation':
        return new MissingUpstreamExpectationError();
    }
  }
}
