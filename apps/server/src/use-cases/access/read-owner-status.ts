import type { ReadOwnerStatusService } from '@porcelain/access/services';
import type { ReadOwnerStatusResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadOwnerStatusUseCase {
  private readonly readOwnerStatus: ReadOwnerStatusService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    readOwnerStatus: ReadOwnerStatusService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.readOwnerStatus = readOwnerStatus;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<ReadOwnerStatusResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'read',
      async () => this.readOwnerStatus.execute(),
      { callerSignal: context.signal },
    );
  }
}
