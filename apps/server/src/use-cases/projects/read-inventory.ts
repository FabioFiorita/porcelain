import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type { Context } from 'effect';
import { Effect } from 'effect';
import type {
  ReadEnvironmentNameService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import type {
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import { inventoryReport } from '@porcelain/projects/rules';
import type { ReadInventoryBadgesUseCasePort } from '../../ports/read-inventory-badges-use-case-port.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class ReadInventoryUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly readBadges: ReadInventoryBadgesUseCasePort;
  private readonly readEnvironment: Context.Service.Shape<
    typeof ReadEnvironmentService
  >;
  private readonly readEnvironmentName: Context.Service.Shape<
    typeof ReadEnvironmentNameService
  >;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    readBadges: ReadInventoryBadgesUseCasePort,
    readEnvironment: Context.Service.Shape<typeof ReadEnvironmentService>,
    readEnvironmentName: Context.Service.Shape<
      typeof ReadEnvironmentNameService
    >,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.readBadges = readBadges;
    this.readEnvironment = readEnvironment;
    this.readEnvironmentName = readEnvironmentName;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(): Effect.Effect<
    ReadInventoryResponse,
    MissingEnvironmentIdentityError
  > {
    return Effect.gen({ self: this }, function* () {
      const { inventory, listings } = yield* this.lanes.run(
        this.laneKeys.inventory(),
        'read',
        () =>
          Effect.gen({ self: this }, function* () {
            const inventory = yield* this.listRegisteredProjects.execute();
            return {
              inventory,
              listings: (yield* this.listKnownWorktrees.execute(inventory))
                .listings,
            };
          }),
      );
      const statuses = yield* this.readBadges.execute({ listings });
      const { environmentId, environment } = yield* this.lanes.run(
        this.laneKeys.access(),
        'read',
        () =>
          Effect.gen({ self: this }, function* () {
            return {
              environmentId: (yield* this.readEnvironment.execute())
                .environmentId,
              environment: yield* this.readEnvironmentName.execute(),
            };
          }),
      );
      return {
        ...inventoryReport(environmentId, inventory, listings, statuses),
        environment,
      };
    });
  }
}
