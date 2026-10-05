import type { Context } from 'effect';
import { Effect } from 'effect';
import type { FlushDeviceActivityService } from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class FlushDeviceActivityUseCase {
  private readonly flushDeviceActivity: Context.Service.Shape<
    typeof FlushDeviceActivityService
  >;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    flushDeviceActivity: Context.Service.Shape<
      typeof FlushDeviceActivityService
    >,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.flushDeviceActivity = flushDeviceActivity;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(): Effect.Effect<void, never> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.flushDeviceActivity.execute();
        }),
      );
    });
  }
}
