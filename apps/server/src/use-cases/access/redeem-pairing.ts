import type { RedeemPairingService } from '@porcelain/access/services';
import type {
  RedeemPairingRequest,
  RedeemPairingResponse,
} from '@porcelain/contracts/access';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

const ACCESS_LANE = 'access';

export class RedeemPairingUseCase {
  private readonly redeemPairing: RedeemPairingService;
  private readonly lanes: Lanes;

  constructor(redeemPairing: RedeemPairingService, lanes: Lanes) {
    this.redeemPairing = redeemPairing;
    this.lanes = lanes;
  }

  execute(
    input: RedeemPairingRequest,
    context: OperationContext,
  ): Promise<RedeemPairingResponse> {
    return this.lanes.run(
      ACCESS_LANE,
      'write',
      async () => this.redeemPairing.execute(input),
      { callerSignal: context.signal },
    );
  }
}
