import type {
  ReadEnvironmentNameService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import type { ReadEnvironmentResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

type ReadEnvironmentOptions = {
  version: string | undefined;
  protocol: number;
};

export class ReadEnvironmentUseCase {
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly readEnvironmentName: ReadEnvironmentNameService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly options: ReadEnvironmentOptions;

  constructor(
    readEnvironment: ReadEnvironmentService,
    readEnvironmentName: ReadEnvironmentNameService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    options: ReadEnvironmentOptions,
  ) {
    this.readEnvironment = readEnvironment;
    this.readEnvironmentName = readEnvironmentName;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.options = options;
  }

  execute(context: OperationContext): Promise<ReadEnvironmentResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'read',
      async () => ({
        environmentId: this.readEnvironment.execute().environmentId,
        name: this.readEnvironmentName.execute().name,
        version: this.options.version,
        protocol: this.options.protocol,
      }),
      { callerSignal: context.signal },
    );
  }
}
