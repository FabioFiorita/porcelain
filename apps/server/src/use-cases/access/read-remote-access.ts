import { Effect } from 'effect';
import type { ReadRemoteAccessService } from '@porcelain/access/services';
import type { ReadRemoteAccessResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

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

  execute(): Effect.Effect<ReadRemoteAccessResponse, never> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.remoteAccess(), 'read', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.readRemoteAccess.execute();
        }),
      );
    });
  }
}
