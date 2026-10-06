import { Effect, Context, Layer } from 'effect';
import { type ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  type ListFilePreferencesParams,
  type ListFilePreferencesResponse,
} from '@porcelain/contracts/projects';
import {
  CheckProjectService,
  ListFilePreferencesService,
} from '@porcelain/projects/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ListFilePreferencesUseCase extends Context.Service<
  ListFilePreferencesUseCase,
  {
    readonly execute: (
      input: ListFilePreferencesParams,
    ) => Effect.Effect<ListFilePreferencesResponse, ProjectNotFoundError>;
  }
>()('@porcelain/server/ListFilePreferencesUseCase') {
  static readonly layer = Layer.effect(
    ListFilePreferencesUseCase,
    Effect.gen(function* () {
      const checkProjectCapability = yield* CheckProjectService;
      const listFilePreferencesCapability = yield* ListFilePreferencesService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ListFilePreferencesUseCase.execute')(function* (
          input: ListFilePreferencesParams,
        ): Effect.fn.Return<ListFilePreferencesResponse, ProjectNotFoundError> {
          const project = yield* checkProjectCapability.execute({
            projectId: input.projectId,
          });
          return yield* lanesCapability.run(
            laneKeysCapability.project(project),
            'read',
            () => listFilePreferencesCapability.execute(input),
          );
        }),
      };
    }),
  );
}
