import { InventoryRefresh } from '../../ports/inventory-refresh.ts';
import { Effect, Context, Layer } from 'effect';
import { type ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  type RemoveProjectParams,
  type RemoveProjectResponse,
} from '@porcelain/contracts/projects';
import {
  FindProjectService,
  ForgetProjectRecordsService,
  RemoveProjectService,
} from '@porcelain/projects/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RemoveProjectUseCase extends Context.Service<
  RemoveProjectUseCase,
  {
    readonly execute: (
      input: RemoveProjectParams,
    ) => Effect.Effect<RemoveProjectResponse, ProjectNotFoundError>;
  }
>()('@porcelain/server/RemoveProjectUseCase') {
  static readonly layer = Layer.effect(
    RemoveProjectUseCase,
    Effect.gen(function* () {
      const findProjectCapability = yield* FindProjectService;
      const forgetProjectRecordsCapability = yield* ForgetProjectRecordsService;
      const removeProjectCapability = yield* RemoveProjectService;
      const refreshInventoryCapability = yield* InventoryRefresh;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('RemoveProjectUseCase.execute')(function* (
          input: RemoveProjectParams,
        ): Effect.fn.Return<RemoveProjectResponse, ProjectNotFoundError> {
          const found = yield* findProjectCapability.execute({
            projectId: input.projectId,
          });
          if (found.kind === 'missing') return { deleted: false };
          yield* lanesCapability.run(
            laneKeysCapability.project(found.project),
            'write',
            () => forgetProjectRecordsCapability.execute(input),
          );
          const result = yield* lanesCapability.run(
            laneKeysCapability.inventory(),
            'write',
            () => removeProjectCapability.execute(input),
          );
          if (result.deleted) {
            yield* refreshInventoryCapability.execute();
            eventsCapability.inventoryChanged();
          }
          return result;
        }),
      };
    }),
  );
}
