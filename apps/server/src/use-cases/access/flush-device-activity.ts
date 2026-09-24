import type { FlushDeviceActivityService } from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class FlushDeviceActivityUseCase {
  private readonly flushDeviceActivity: FlushDeviceActivityService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    flushDeviceActivity: FlushDeviceActivityService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.flushDeviceActivity = flushDeviceActivity;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<void> {
    return this.lanes.run(
      this.laneKeys.access(),
      'write',
      async () => this.flushDeviceActivity.execute(),
      { callerSignal: context.signal },
    );
  }
}
