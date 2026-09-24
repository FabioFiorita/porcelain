import type { ClearBrowserSessionResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ClearBrowserSessionUseCase {
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(lanes: Lanes, laneKeys: LaneKeys) {
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<ClearBrowserSessionResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'read',
      async (): Promise<ClearBrowserSessionResponse> => undefined,
      { callerSignal: context.signal },
    );
  }
}
