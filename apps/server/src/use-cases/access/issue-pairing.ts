import type {
  IssuePairingService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import type {
  IssuePairingRequest,
  IssuePairingResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class IssuePairingUseCase {
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly issuePairing: IssuePairingService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    readEnvironment: ReadEnvironmentService,
    issuePairing: IssuePairingService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.readEnvironment = readEnvironment;
    this.issuePairing = issuePairing;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: IssuePairingRequest,
    context: OperationContext,
  ): Promise<IssuePairingResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'write',
      async () => {
        const { environmentId } = this.readEnvironment.execute();
        return this.issuePairing.execute({ ...input, environmentId });
      },
      { callerSignal: context.signal },
    );
  }
}
