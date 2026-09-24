import type { ListAccessService } from '@porcelain/access/services';
import type { ListAccessResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListAccessUseCase {
  private readonly listAccess: ListAccessService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(listAccess: ListAccessService, lanes: Lanes, laneKeys: LaneKeys) {
    this.listAccess = listAccess;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<ListAccessResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'read',
      async () => this.listAccess.execute(),
      { callerSignal: context.signal },
    );
  }
}
