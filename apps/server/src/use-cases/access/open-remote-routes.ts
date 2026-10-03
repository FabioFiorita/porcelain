import type {
  CloseTunnelConnectionsService,
  OpenRemoteRoutesService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class OpenRemoteRoutesUseCase {
  private readonly openRemoteRoutes: OpenRemoteRoutesService;
  private readonly closeTunnelConnections: CloseTunnelConnectionsService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    openRemoteRoutes: OpenRemoteRoutesService,
    closeTunnelConnections: CloseTunnelConnectionsService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.openRemoteRoutes = openRemoteRoutes;
    this.closeTunnelConnections = closeTunnelConnections;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<void> {
    return this.lanes.run(
      this.laneKeys.remoteAccess(),
      'write',
      async ({ signal }) => {
        await this.openRemoteRoutes.execute(
          this.readEnvironment.execute(),
          signal,
        );
        this.closeTunnelConnections.execute();
      },
      { callerSignal: context.signal },
    );
  }
}
