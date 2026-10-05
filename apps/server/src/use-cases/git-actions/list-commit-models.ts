import { ListCommitModelsUseCaseOptions } from '../../ports/list-commit-models-use-case-options.ts';
import { Effect, Context, Layer } from 'effect';
import { type ListCommitModelsResponse } from '@porcelain/contracts/git-actions';
import { ListCommitModelsService } from '@porcelain/git-actions/services';
import { Lanes } from '../../runtime/lanes.ts';

export class ListCommitModelsUseCase extends Context.Service<
  ListCommitModelsUseCase,
  { readonly execute: () => Effect.Effect<ListCommitModelsResponse> }
>()('@porcelain/server/ListCommitModelsUseCase') {
  static readonly layer = Layer.effect(
    ListCommitModelsUseCase,
    Effect.gen(function* () {
      const listCommitModelsCapability = yield* ListCommitModelsService;
      const lanesCapability = yield* Lanes;
      const optionsCapability = yield* ListCommitModelsUseCaseOptions;

      return {
        execute: Effect.fn('ListCommitModelsUseCase.execute')(
          function* (): Effect.fn.Return<ListCommitModelsResponse> {
            return yield* lanesCapability.unqueued(
              () => listCommitModelsCapability.execute(),
              optionsCapability,
            );
          },
        ),
      };
    }),
  );
}
