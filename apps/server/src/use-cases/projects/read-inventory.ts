import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Context, Effect, Layer } from 'effect';
import {
  ReadEnvironmentNameService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import { type ReadInventoryResponse } from '@porcelain/contracts/projects';
import {
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import { inventoryReport } from '@porcelain/projects/rules';
import { ReadInventoryBadgesUseCasePort } from '../../ports/read-inventory-badges-use-case-port.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ReadInventoryUseCase extends Context.Service<
  ReadInventoryUseCase,
  {
    readonly execute: () => Effect.Effect<
      ReadInventoryResponse,
      MissingEnvironmentIdentityError
    >;
  }
>()('@porcelain/server/ReadInventoryUseCase') {
  static readonly layer = Layer.effect(
    ReadInventoryUseCase,
    Effect.gen(function* () {
      const listRegisteredProjectsCapability =
        yield* ListRegisteredProjectsService;
      const listKnownWorktreesCapability = yield* ListKnownWorktreesService;
      const readBadgesCapability = yield* ReadInventoryBadgesUseCasePort;
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const readEnvironmentNameCapability = yield* ReadEnvironmentNameService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ReadInventoryUseCase.execute')(
          function* (): Effect.fn.Return<
            ReadInventoryResponse,
            MissingEnvironmentIdentityError
          > {
            const { inventory, listings } = yield* lanesCapability.run(
              laneKeysCapability.inventory(),
              'read',
              () =>
                Effect.gen(function* () {
                  const inventory =
                    yield* listRegisteredProjectsCapability.execute();
                  return {
                    inventory,
                    listings: (yield* listKnownWorktreesCapability.execute(
                      inventory,
                    )).listings,
                  };
                }),
            );
            const statuses = yield* readBadgesCapability.execute({ listings });
            const { environmentId, environment } = yield* lanesCapability.run(
              laneKeysCapability.access(),
              'read',
              () =>
                Effect.gen(function* () {
                  return {
                    environmentId: (yield* readEnvironmentCapability.execute())
                      .environmentId,
                    environment: yield* readEnvironmentNameCapability.execute(),
                  };
                }),
            );
            return {
              ...inventoryReport(environmentId, inventory, listings, statuses),
              environment,
            };
          },
        ),
      };
    }),
  );
}
