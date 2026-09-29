import type { ReadRemoteAccessService } from '@porcelain/access/services';
import type { ReadRemoteAccessResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class ReadRemoteAccessUseCase {
  private readonly readRemoteAccess: ReadRemoteAccessService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    readRemoteAccess: ReadRemoteAccessService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.readRemoteAccess = readRemoteAccess;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<ReadRemoteAccessResponse> {
    return this.lanes.run(
      this.laneKeys.remoteAccess(),
      'read',
      async () => this.readRemoteAccess.execute(),
      { callerSignal: context.signal },
    );
  }
}
