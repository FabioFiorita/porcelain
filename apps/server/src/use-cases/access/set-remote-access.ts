import type {
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
import type { OperationContext } from '../../ports/operation-context.ts';

export class SetRemoteAccessUseCase {
  private readonly setRemoteAccess: SetRemoteAccessService;
  private readonly openRemoteRoutes: OpenRemoteRoutesService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly logger: Logger;

  constructor(
    setRemoteAccess: SetRemoteAccessService,
    openRemoteRoutes: OpenRemoteRoutesService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    logger: Logger,
  ) {
    this.setRemoteAccess = setRemoteAccess;
    this.openRemoteRoutes = openRemoteRoutes;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.logger = logger;
  }

  async execute(
    input: SetRemoteAccessRequest,
    context: OperationContext,
  ): Promise<SetRemoteAccessResponse> {
    const changed = await this.lanes.run(
      this.laneKeys.remoteAccess(),
      'write',
      async () => this.setRemoteAccess.execute(input),
      { callerSignal: context.signal },
    );
    this.lanes.background(
      this.laneKeys.remoteAccess(),
      async ({ signal }) =>
        this.openRemoteRoutes.execute(this.readEnvironment.execute(), signal),
      {
        onFailure: (error) =>
          this.logger.failure({
            kind: 'job',
            job: 'open-remote-routes',
            error,
          }),
      },
    );
    return changed;
  }
}
