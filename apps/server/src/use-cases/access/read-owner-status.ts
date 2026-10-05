import type { Context } from 'effect';
import { Effect } from 'effect';
import type { ReadOwnerStatusService } from '@porcelain/access/services';
import type { ReadOwnerStatusResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class ReadOwnerStatusUseCase {
  private readonly readOwnerStatus: Context.Service.Shape<
    typeof ReadOwnerStatusService
  >;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    readOwnerStatus: Context.Service.Shape<typeof ReadOwnerStatusService>,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.readOwnerStatus = readOwnerStatus;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(): Effect.Effect<ReadOwnerStatusResponse, never> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'read', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.readOwnerStatus.execute();
        }),
      );
    });
  }
}
