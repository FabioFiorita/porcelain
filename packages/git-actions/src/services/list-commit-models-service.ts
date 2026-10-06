import { Effect, Context, Layer } from 'effect';
import { type ListCommitModelsResult } from '../models/list-commit-models.ts';
import { CommitModelReader } from '../ports/commit-model-reader.ts';

export class ListCommitModelsService extends Context.Service<
  ListCommitModelsService,
  {
    readonly execute: () => Effect.Effect<ListCommitModelsResult, never, never>;
  }
>()('@porcelain/git-actions/ListCommitModelsService') {
  static readonly layer = Layer.effect(
    ListCommitModelsService,
    Effect.gen(function* () {
      const commitModelReaderCapability = yield* CommitModelReader;

      return {
        execute: Effect.fn('ListCommitModelsService.execute')(
          function* (): Effect.fn.Return<ListCommitModelsResult, never, never> {
            return yield* commitModelReaderCapability.list();
          },
        ),
      };
    }),
  );
}
