import { RecordGitActionProgressOptions } from '../ports/record-git-action-progress-options.ts';
import { Effect, Context, Layer } from 'effect';
import {
  type RecordGitActionProgressInput,
  type RecordGitActionProgressResult,
} from '../models/record-git-action-progress.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class RecordGitActionProgressService extends Context.Service<
  RecordGitActionProgressService,
  {
    readonly execute: (
      input: RecordGitActionProgressInput,
    ) => Effect.Effect<RecordGitActionProgressResult, never, never>;
  }
>()('@porcelain/git-actions/RecordGitActionProgressService') {
  static readonly layer = Layer.effect(
    RecordGitActionProgressService,
    Effect.gen(function* () {
      const gitActionReceiptsCapability = yield* GitActionReceiptStore;
      const optionsCapability = yield* RecordGitActionProgressOptions;

      return {
        execute: Effect.fn('RecordGitActionProgressService.execute')(function* (
          input: RecordGitActionProgressInput,
        ): Effect.fn.Return<RecordGitActionProgressResult, never, never> {
          return yield* Effect.sync<RecordGitActionProgressResult>(() => {
            const current = gitActionReceiptsCapability.read({
              requestId: input.requestId,
            });
            if (current?.state !== 'running') return { kind: 'not-running' };
            const updated = {
              ...current,
              progress: [...current.progress, input.line].slice(
                -optionsCapability.progressLines,
              ),
            };
            gitActionReceiptsCapability.save(updated);
            return { kind: 'recorded', receipt: gitActionReceiptView(updated) };
          });
        }),
      };
    }),
  );
}
