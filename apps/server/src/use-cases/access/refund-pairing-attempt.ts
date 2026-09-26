import type { RefundPairingAttemptInput } from '@porcelain/access/models';
import type { RefundPairingAttemptService } from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class RefundPairingAttemptUseCase {
  private readonly refundPairingAttempt: RefundPairingAttemptService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    refundPairingAttempt: RefundPairingAttemptService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.refundPairingAttempt = refundPairingAttempt;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: RefundPairingAttemptInput,
    context: OperationContext,
  ): Promise<void> {
    return this.lanes.run(
      this.laneKeys.access(),
      'write',
      async () => this.refundPairingAttempt.execute(input),
      { callerSignal: context.signal },
    );
  }
}
