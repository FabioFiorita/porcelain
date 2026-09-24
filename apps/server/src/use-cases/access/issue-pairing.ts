import type {
  IssuePairingService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import type {
  IssuePairingRequest,
  IssuePairingResponse,
} from '@porcelain/contracts/access';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

const ACCESS_LANE = 'access';

export class IssuePairingUseCase {
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly issuePairing: IssuePairingService;
  private readonly lanes: Lanes;

  constructor(
    readEnvironment: ReadEnvironmentService,
    issuePairing: IssuePairingService,
    lanes: Lanes,
  ) {
    this.readEnvironment = readEnvironment;
    this.issuePairing = issuePairing;
    this.lanes = lanes;
  }

  execute(
    input: IssuePairingRequest,
    context: OperationContext,
  ): Promise<IssuePairingResponse> {
    return this.lanes.run(
      ACCESS_LANE,
      'write',
      async () => {
        const { environmentId } = this.readEnvironment.execute();
        return this.issuePairing.execute({ ...input, environmentId });
      },
      { callerSignal: context.signal },
    );
  }
}
