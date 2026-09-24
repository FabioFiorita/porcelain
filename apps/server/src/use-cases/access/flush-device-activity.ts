import type { FlushDeviceActivityService } from '@porcelain/access/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

const ACCESS_LANE = 'access';

export class FlushDeviceActivityUseCase {
  private readonly flushDeviceActivity: FlushDeviceActivityService;
  private readonly lanes: Lanes;

  constructor(flushDeviceActivity: FlushDeviceActivityService, lanes: Lanes) {
    this.flushDeviceActivity = flushDeviceActivity;
    this.lanes = lanes;
  }

  execute(context: OperationContext): Promise<void> {
    return this.lanes.run(
      ACCESS_LANE,
      'write',
      async () => this.flushDeviceActivity.execute(),
      { callerSignal: context.signal },
    );
  }
}
