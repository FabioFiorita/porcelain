import type { CollectAbsentWorktreesResult } from '@porcelain/projects/models';
import type { CollectAbsentWorktreesService } from '@porcelain/projects/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class CollectAbsentWorktreesController {
  private readonly collectAbsentWorktrees: CollectAbsentWorktreesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    collectAbsentWorktrees: CollectAbsentWorktreesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.collectAbsentWorktrees = collectAbsentWorktrees;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: Record<never, never>,
    context: OperationContext,
  ): Promise<CollectAbsentWorktreesResult> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async () => this.collectAbsentWorktrees.execute(input),
      { callerSignal: context.signal },
    );
  }
}
