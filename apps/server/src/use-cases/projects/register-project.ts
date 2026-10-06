import { type RepositoryUnavailableError } from '@porcelain/kernel/errors';
import { InventoryRefresh } from '../../ports/inventory-refresh.ts';
import { Effect, Context, Layer } from 'effect';
import {
  type RegisterProjectRequest,
  type RegisterProjectResponse,
} from '@porcelain/contracts/projects';
import { type ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  InspectProjectRepositoryService,
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
  ReadRepositoryOriginService,
  RegisterProjectService,
} from '@porcelain/projects/services';
import { registeredProjectReport } from '@porcelain/projects/rules';
import { EventPublisher } from '../../ports/event-publisher.ts';

import { ReadInventoryBadgesUseCasePort } from '../../ports/read-inventory-badges-use-case-port.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RegisterProjectUseCase extends Context.Service<
  RegisterProjectUseCase,
  {
    readonly execute: (
      input: RegisterProjectRequest,
    ) => Effect.Effect<
      RegisterProjectResponse,
      RepositoryUnavailableError | ProjectNotFoundError
    >;
  }
>()('@porcelain/server/RegisterProjectUseCase') {
  static readonly layer = Layer.effect(
    RegisterProjectUseCase,
    Effect.gen(function* () {
      const inspectProjectRepositoryCapability =
        yield* InspectProjectRepositoryService;
      const readRepositoryOriginCapability = yield* ReadRepositoryOriginService;
      const registerProjectCapability = yield* RegisterProjectService;
      const refreshInventoryCapability = yield* InventoryRefresh;
      const listRegisteredProjectsCapability =
        yield* ListRegisteredProjectsService;
      const listKnownWorktreesCapability = yield* ListKnownWorktreesService;
      const readBadgesCapability = yield* ReadInventoryBadgesUseCasePort;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('RegisterProjectUseCase.execute')(function* (
          input: RegisterProjectRequest,
        ): Effect.fn.Return<
          RegisterProjectResponse,
          RepositoryUnavailableError | ProjectNotFoundError
        > {
          const registered = yield* lanesCapability.run(
            laneKeysCapability.inventory(),
            'write',
            () =>
              Effect.gen(function* () {
                const repository =
                  yield* inspectProjectRepositoryCapability.execute(input);
                const { originUrl } =
                  yield* readRepositoryOriginCapability.execute(input);
                return yield* registerProjectCapability.execute({
                  repository,
                  originUrl,
                });
              }),
          );
          yield* refreshInventoryCapability.execute();
          const { listings } = yield* lanesCapability.run(
            laneKeysCapability.inventory(),
            'read',
            () =>
              Effect.flatMap(
                listRegisteredProjectsCapability.execute(),
                (inventory) => listKnownWorktreesCapability.execute(inventory),
              ),
          );
          const statuses = yield* readBadgesCapability.execute({ listings });
          if (registered.changed) yield* eventsCapability.inventoryChanged();
          return registeredProjectReport(
            registered.project,
            listings,
            statuses,
          );
        }),
      };
    }),
  );
}
