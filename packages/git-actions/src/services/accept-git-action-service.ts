import type { Clock } from '@porcelain/kernel/ports';
import { DiscardExpectationMismatchError } from '../errors/discard-expectation-mismatch-error.ts';
import { DuplicateExpectedFileError } from '../errors/duplicate-expected-file-error.ts';
import { EmptyCommitSelectionError } from '../errors/empty-commit-selection-error.ts';
import { ExpectedFilesMismatchError } from '../errors/expected-files-mismatch-error.ts';
import { GitActionReceiptMismatchError } from '../errors/git-action-receipt-mismatch-error.ts';
import { MergeExpectationMismatchError } from '../errors/merge-expectation-mismatch-error.ts';
import { MissingExpectedFilesError } from '../errors/missing-expected-files-error.ts';
import { MissingUpstreamExpectationError } from '../errors/missing-upstream-expectation-error.ts';
import type {
  AcceptGitActionInput,
  AcceptGitActionResult,
} from '../models/accept-git-action.ts';
import type { GitActionExpectation } from '../models/git-action-expectation.ts';
import type { GitActionIntent } from '../models/git-action-intent.ts';
import type { GitActionReceipt } from '../models/git-action-receipt.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { commitExpectsSelectedFiles } from '../rules/commit-expects-selected-files.ts';
import { commitSelectsPaths } from '../rules/commit-selects-paths.ts';
import { discardExpectsItsPath } from '../rules/discard-expects-its-path.ts';
import { expectedFilesAreUnique } from '../rules/expected-files-are-unique.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';
import { gitActionTarget } from '../rules/git-action-target.ts';
import { mergeExpectationAgrees } from '../rules/merge-expectation-agrees.ts';
import { networkActionExpectsUpstream } from '../rules/network-action-expects-upstream.ts';
import { sameGitActionRequest } from '../rules/same-git-action-request.ts';
import { stashExpectsFiles } from '../rules/stash-expects-files.ts';

export class AcceptGitActionService {
  private readonly gitActionReceipts: GitActionReceiptStore;
  private readonly clock: Clock;

  constructor(gitActionReceipts: GitActionReceiptStore, clock: Clock) {
    this.gitActionReceipts = gitActionReceipts;
    this.clock = clock;
  }

  execute(input: AcceptGitActionInput): AcceptGitActionResult {
    const { intent, expected } = input;
    this.checkRequest(intent, expected);
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

  private checkRequest(
    intent: GitActionIntent,
    expected: GitActionExpectation,
  ): void {
    if (!expectedFilesAreUnique(expected))
      throw new DuplicateExpectedFileError();
    if (!mergeExpectationAgrees(expected))
      throw new MergeExpectationMismatchError();
    if (!commitSelectsPaths(intent, expected))
      throw new EmptyCommitSelectionError();
    const commit = commitExpectsSelectedFiles(intent, expected);
    if (commit === 'missing') throw new MissingExpectedFilesError();
    if (commit === 'mismatched') throw new ExpectedFilesMismatchError();
    if (!discardExpectsItsPath(intent, expected))
      throw new DiscardExpectationMismatchError();
    if (!stashExpectsFiles(intent, expected))
      throw new MissingExpectedFilesError();
    if (!networkActionExpectsUpstream(intent, expected))
      throw new MissingUpstreamExpectationError();
  }
}
