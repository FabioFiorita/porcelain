import type {
  RevokeAccessRequest,
  RevokeAccessResponse,
} from '@porcelain/contracts/access';
import type {
  RevokeDeviceService,
  RevokePairingGrantService,
} from '@porcelain/access/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RevokeAccessUseCase {
  private readonly revokePairingGrantService: RevokePairingGrantService;
  private readonly revokeDeviceService: RevokeDeviceService;
  private readonly lanes: Lanes;

  constructor(
    revokePairingGrantService: RevokePairingGrantService,
    revokeDeviceService: RevokeDeviceService,
    lanes: Lanes,
  ) {
    this.revokePairingGrantService = revokePairingGrantService;
    this.revokeDeviceService = revokeDeviceService;
    this.lanes = lanes;
  }

  execute(
    input: RevokeAccessRequest,
    context: OperationContext,
  ): Promise<RevokeAccessResponse> {
    return this.lanes.unqueued(
      async () => {
        const grant = this.revokePairingGrantService.execute(input);
        if (grant.revoked) return grant;
        return this.revokeDeviceService.execute(input);
      },
      { callerSignal: context.signal },
    );
  }
}
