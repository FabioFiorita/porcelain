import type { Context } from 'effect';
import { Effect } from 'effect';
import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type {
  CloseTunnelConnectionsService,
  OpenRemoteRoutesService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class OpenRemoteRoutesUseCase {
  private readonly openRemoteRoutes: Context.Service.Shape<
    typeof OpenRemoteRoutesService
  >;
  private readonly closeTunnelConnections: Context.Service.Shape<
    typeof CloseTunnelConnectionsService
  >;
  private readonly readEnvironment: Context.Service.Shape<
    typeof ReadEnvironmentService
  >;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    openRemoteRoutes: Context.Service.Shape<typeof OpenRemoteRoutesService>,
    closeTunnelConnections: Context.Service.Shape<
      typeof CloseTunnelConnectionsService
    >,
    readEnvironment: Context.Service.Shape<typeof ReadEnvironmentService>,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.openRemoteRoutes = openRemoteRoutes;
    this.closeTunnelConnections = closeTunnelConnections;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(): Effect.Effect<void, MissingEnvironmentIdentityError> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.remoteAccess(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          yield* this.openRemoteRoutes.execute(
            yield* this.readEnvironment.execute(),
          );
          yield* this.closeTunnelConnections.execute();
        }),
      );
    });
  }
}
