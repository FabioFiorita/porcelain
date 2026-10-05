import { Effect } from 'effect';
import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type {
  OpenRemoteRoutesService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class CloseRemoteRoutesUseCase {
  private readonly openRemoteRoutes: OpenRemoteRoutesService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    openRemoteRoutes: OpenRemoteRoutesService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.openRemoteRoutes = openRemoteRoutes;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(): Effect.Effect<void, MissingEnvironmentIdentityError> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.remoteAccess(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.openRemoteRoutes.execute({
            ...(yield* this.readEnvironment.execute()),
            closing: true,
          });
        }),
      );
    });
  }
}
