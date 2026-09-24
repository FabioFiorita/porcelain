import type {
  RedeemPairingRequest,
  RedeemPairingResponse,
} from '@porcelain/contracts/access';
import type { RedeemPairingService } from '@porcelain/access/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RedeemPairingUseCase {
  private readonly redeemPairingService: RedeemPairingService;
  private readonly lanes: Lanes;

  constructor(redeemPairingService: RedeemPairingService, lanes: Lanes) {
    this.redeemPairingService = redeemPairingService;
    this.lanes = lanes;
  }

  execute(
    input: RedeemPairingRequest,
    context: OperationContext,
  ): Promise<RedeemPairingResponse> {
    return this.lanes.unqueued(
      async () => this.redeemPairingService.execute(input),
      { callerSignal: context.signal },
    );
  }
}
