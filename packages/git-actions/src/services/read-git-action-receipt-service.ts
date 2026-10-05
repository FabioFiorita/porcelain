import { Effect } from 'effect';
import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import type {
  ReadGitActionReceiptInput,
  ReadGitActionReceiptResult,
} from '../models/read-git-action-receipt.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class ReadGitActionReceiptService {
  private readonly gitActionReceipts: GitActionReceiptStore;

  constructor(gitActionReceipts: GitActionReceiptStore) {
    this.gitActionReceipts = gitActionReceipts;
  }

  execute(
    input: ReadGitActionReceiptInput,
  ): Effect.Effect<ReadGitActionReceiptResult, GitActionNotFoundError, never> {
    return Effect.gen({ self: this }, function* () {
      const receipt = this.gitActionReceipts.read({
        requestId: input.requestId,
      });
      if (!receipt || receipt.worktreeId !== input.worktreeId)
        return yield* Effect.fail(new GitActionNotFoundError());
      return gitActionReceiptView(receipt);
    });
  }
}
