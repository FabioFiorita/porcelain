import type { FlushDeviceActivityService } from '@porcelain/access/services';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class FlushDeviceActivityController {
  private readonly flushDeviceActivity: FlushDeviceActivityService;
  private readonly lanes: Lanes;

  constructor(flushDeviceActivity: FlushDeviceActivityService, lanes: Lanes) {
    this.flushDeviceActivity = flushDeviceActivity;
    this.lanes = lanes;
  }

  execute(context: OperationContext): Promise<void> {
    return this.lanes.unqueued(async () => this.flushDeviceActivity.execute(), {
      callerSignal: context.signal,
    });
  }
}
