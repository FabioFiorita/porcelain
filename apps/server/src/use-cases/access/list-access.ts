import { Effect } from 'effect';
import type { ListAccessService } from '@porcelain/access/services';
import type {
  ListAccessRequest,
  ListAccessResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class ListAccessUseCase {
  private readonly listAccess: ListAccessService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(listAccess: ListAccessService, lanes: Lanes, laneKeys: LaneKeys) {
    this.listAccess = listAccess;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(input: ListAccessRequest): Effect.Effect<ListAccessResponse, never> {
    return Effect.gen({ self: this }, function* () {
      const { viewer } = input;
      return yield* this.lanes.run(this.laneKeys.access(), 'read', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.listAccess.execute({
            viewerDeviceId:
              viewer.kind === 'device' ? viewer.deviceId : undefined,
          });
        }),
      );
    });
  }
}
