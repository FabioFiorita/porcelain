import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class ReadHealthUseCase {
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<ReadHealthResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'read',
      async () => {
        const { environmentId } = this.readEnvironment.execute();
        return { status: 'ok', environmentId };
      },
      { callerSignal: context.signal },
    );
  }
}
