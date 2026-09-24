import type { TakePairingAttemptInput } from '@porcelain/access/models';
import type { TakePairingAttemptService } from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class TakePairingAttemptUseCase {
  private readonly takePairingAttempt: TakePairingAttemptService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    takePairingAttempt: TakePairingAttemptService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.takePairingAttempt = takePairingAttempt;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: TakePairingAttemptInput,
    context: OperationContext,
  ): Promise<void> {
    return this.lanes.run(
      this.laneKeys.access(),
      'write',
      async () => this.takePairingAttempt.execute(input),
      { callerSignal: context.signal },
    );
  }
}
