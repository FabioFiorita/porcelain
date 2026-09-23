import { GitActionReceiptMismatchError } from '../errors/git-action-receipt-mismatch-error.ts';
import type {
  AcceptGitActionInput,
  AcceptGitActionResult,
} from '../models/git-action-operations.ts';
import type { GitActionReceipt } from '../models/git-action-receipt.ts';
import type { Clock } from '../ports/clock.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { commitExpectsSelectedFiles } from '../rules/commit-expects-selected-files.ts';
import { commitSelectsPaths } from '../rules/commit-selects-paths.ts';
import { discardExpectsItsPath } from '../rules/discard-expects-its-path.ts';
import { expectedFilesAreUnique } from '../rules/expected-files-are-unique.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';
import { mergeExpectationAgrees } from '../rules/merge-expectation-agrees.ts';
import { networkActionExpectsUpstream } from '../rules/network-action-expects-upstream.ts';
import { sameGitActionRequest } from '../rules/same-git-action-request.ts';
import { stashExpectsFiles } from '../rules/stash-expects-files.ts';

export class AcceptGitActionService {
  private readonly gitActionReceiptStore: GitActionReceiptStore;
  private readonly clock: Clock;

  constructor(gitActionReceiptStore: GitActionReceiptStore, clock: Clock) {
    this.gitActionReceiptStore = gitActionReceiptStore;
    this.clock = clock;
  }

  execute(input: AcceptGitActionInput): AcceptGitActionResult {
    const { intent, expected } = input;
    expectedFilesAreUnique(expected);
    mergeExpectationAgrees(expected);
    commitSelectsPaths(intent, expected);
    commitExpectsSelectedFiles(intent, expected);
    discardExpectsItsPath(intent, expected);
    stashExpectsFiles(intent, expected);
    networkActionExpectsUpstream(intent, expected);
    const previous = this.gitActionReceiptStore.read(input.requestId);
    if (previous) {
      if (!sameGitActionRequest(previous, input))
        throw new GitActionReceiptMismatchError();
      return { receipt: gitActionReceiptView(previous), run: undefined };
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
      acceptedAt: Date.parse(this.clock.now()),
    };
    this.gitActionReceiptStore.insert(receipt);
    return {
      receipt: gitActionReceiptView(receipt),
      run: {
        requestId: input.requestId,
        projectId: input.projectId,
        worktreeId: input.worktreeId,
        intent,
        expected,
      },
    };
  }
}
