import { Effect, Context, Layer } from 'effect';
import { type ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  type RenameProjectParams,
  type RenameProjectRequest,
  type RenameProjectResponse,
} from '@porcelain/contracts/projects';
import { RenameProjectService } from '@porcelain/projects/services';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RenameProjectUseCase extends Context.Service<
  RenameProjectUseCase,
  {
    readonly execute: (
      input: RenameProjectParams & RenameProjectRequest,
    ) => Effect.Effect<RenameProjectResponse, ProjectNotFoundError>;
  }
>()('@porcelain/server/RenameProjectUseCase') {
  static readonly layer = Layer.effect(
    RenameProjectUseCase,
    Effect.gen(function* () {
      const renameProjectCapability = yield* RenameProjectService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('RenameProjectUseCase.execute')(function* (
          input: RenameProjectParams & RenameProjectRequest,
        ): Effect.fn.Return<RenameProjectResponse, ProjectNotFoundError> {
          return yield* lanesCapability
            .run(laneKeysCapability.inventory(), 'write', () =>
              renameProjectCapability.execute(input),
            )
            .pipe(
              Effect.map((result) => {
                if (result.changed) eventsCapability.inventoryChanged();
                return result.project;
              }),
            );
        }),
      };
    }),
  );
}
