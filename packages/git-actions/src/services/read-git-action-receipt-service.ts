import { Effect, Context, Layer } from 'effect';
import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import {
  type ReadGitActionReceiptInput,
  type ReadGitActionReceiptResult,
} from '../models/read-git-action-receipt.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class ReadGitActionReceiptService extends Context.Service<
  ReadGitActionReceiptService,
  {
    readonly execute: (
      input: ReadGitActionReceiptInput,
    ) => Effect.Effect<
      ReadGitActionReceiptResult,
      GitActionNotFoundError,
      never
    >;
  }
>()('@porcelain/git-actions/ReadGitActionReceiptService') {
  static readonly layer = Layer.effect(
    ReadGitActionReceiptService,
    Effect.gen(function* () {
      const gitActionReceiptsCapability = yield* GitActionReceiptStore;

      return {
        execute: Effect.fn('ReadGitActionReceiptService.execute')(function* (
          input: ReadGitActionReceiptInput,
        ): Effect.fn.Return<
          ReadGitActionReceiptResult,
          GitActionNotFoundError,
          never
        > {
          const receipt = yield* gitActionReceiptsCapability.read({
            requestId: input.requestId,
          });
          if (!receipt || receipt.worktreeId !== input.worktreeId)
            return yield* Effect.fail(new GitActionNotFoundError());
          return gitActionReceiptView(receipt);
        }),
      };
    }),
  );
}
