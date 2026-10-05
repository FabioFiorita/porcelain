import type {
  CloseTunnelConnectionsService,
  OpenRemoteRoutesService,
  ReadEnvironmentService,
  SetRemoteAccessService,
} from '@porcelain/access/services';
import type {
  SetRemoteAccessRequest,
  SetRemoteAccessResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { Logger } from '../../ports/logger.ts';
import type { Context } from 'effect';
import { Cause, Effect } from 'effect';
import type {
  InvalidTailnetHostnameError,
  InvalidTunnelHostnameError,
  MissingTailnetHostnameError,
  MissingTunnelHostnameError,
  NoLocalNetworkError,
  UnidentifiedLocalNetworkError,
} from '@porcelain/access/errors';

export class SetRemoteAccessUseCase {
  private readonly setRemoteAccess: Context.Service.Shape<
    typeof SetRemoteAccessService
  >;
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
  private readonly logger: Logger;

  constructor(
    setRemoteAccess: Context.Service.Shape<typeof SetRemoteAccessService>,
    openRemoteRoutes: Context.Service.Shape<typeof OpenRemoteRoutesService>,
    closeTunnelConnections: Context.Service.Shape<
      typeof CloseTunnelConnectionsService
    >,
    readEnvironment: Context.Service.Shape<typeof ReadEnvironmentService>,
    lanes: Lanes,
    laneKeys: LaneKeys,
    logger: Logger,
  ) {
    this.setRemoteAccess = setRemoteAccess;
    this.openRemoteRoutes = openRemoteRoutes;
    this.closeTunnelConnections = closeTunnelConnections;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.logger = logger;
  }

  execute(
    input: SetRemoteAccessRequest,
  ): Effect.Effect<
    SetRemoteAccessResponse,
    | InvalidTailnetHostnameError
    | InvalidTunnelHostnameError
    | MissingTailnetHostnameError
    | MissingTunnelHostnameError
    | NoLocalNetworkError
    | UnidentifiedLocalNetworkError
  > {
    return this.lanes.commit(
      this.laneKeys.remoteAccess(),
      () =>
        Effect.uninterruptible(
          Effect.gen({ self: this }, function* () {
            const changed = yield* this.setRemoteAccess.execute(input);
            yield* this.closeTunnelConnections.execute();
            return changed;
          }),
        ),
      () =>
        this.lanes.background(
          this.laneKeys.remoteAccess(),
          () =>
            Effect.gen({ self: this }, function* () {
              yield* this.openRemoteRoutes.execute(
                yield* this.readEnvironment.execute(),
              );
              yield* this.closeTunnelConnections.execute();
            }),
          (cause) =>
            Cause.hasInterruptsOnly(cause)
              ? Effect.void
              : Effect.sync(() =>
                  this.logger.failure({
                    kind: 'job',
                    job: 'open-remote-routes',
                    error: Cause.squash(cause),
                  }),
                ),
        ),
    );
  }
}
