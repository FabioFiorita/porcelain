import type { RedeemPairingService } from '@porcelain/access/services';
import type {
  RedeemPairingRequest,
  RedeemPairingResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class RedeemPairingUseCase {
  private readonly redeemPairing: RedeemPairingService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    redeemPairing: RedeemPairingService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.redeemPairing = redeemPairing;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: RedeemPairingRequest,
    context: OperationContext,
  ): Promise<RedeemPairingResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'write',
      async () => this.redeemPairing.execute(input),
      { callerSignal: context.signal },
    );
  }
}
