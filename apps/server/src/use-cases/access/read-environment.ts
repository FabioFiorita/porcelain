import type { Context } from 'effect';
import { Effect } from 'effect';
import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type {
  ReadEnvironmentNameService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import type { ReadEnvironmentResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

type ReadEnvironmentOptions = {
  version: string | undefined;
  protocol: number;
};

export class ReadEnvironmentUseCase {
  private readonly readEnvironment: Context.Service.Shape<
    typeof ReadEnvironmentService
  >;
  private readonly readEnvironmentName: Context.Service.Shape<
    typeof ReadEnvironmentNameService
  >;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly options: ReadEnvironmentOptions;

  constructor(
    readEnvironment: Context.Service.Shape<typeof ReadEnvironmentService>,
    readEnvironmentName: Context.Service.Shape<
      typeof ReadEnvironmentNameService
    >,
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

  execute(): Effect.Effect<
    ReadEnvironmentResponse,
    MissingEnvironmentIdentityError
  > {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'read', () =>
        Effect.gen({ self: this }, function* () {
          return {
            environmentId: (yield* this.readEnvironment.execute())
              .environmentId,
            name: (yield* this.readEnvironmentName.execute()).name,
            version: this.options.version,
            protocol: this.options.protocol,
          };
        }),
      );
    });
  }
}
