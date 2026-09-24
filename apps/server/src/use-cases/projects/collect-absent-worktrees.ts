import type {
  CollectAbsentWorktreesService,
  ListExpiredWorktreesService,
} from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class CollectAbsentWorktreesUseCase {
  private readonly listExpiredWorktrees: ListExpiredWorktreesService;
  private readonly collectAbsentWorktrees: CollectAbsentWorktreesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listExpiredWorktrees: ListExpiredWorktreesService,
    collectAbsentWorktrees: CollectAbsentWorktreesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listExpiredWorktrees = listExpiredWorktrees;
    this.collectAbsentWorktrees = collectAbsentWorktrees;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(context: OperationContext): Promise<void> {
    const { worktrees } = await this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () => this.listExpiredWorktrees.execute(),
      { callerSignal: context.signal },
    );
    for (const worktree of worktrees)
      await this.lanes.run(
        this.laneKeys.repository(worktree),
        'write',
        async () =>
          this.collectAbsentWorktrees.execute({ worktreeIds: [worktree.id] }),
        { callerSignal: context.signal },
      );
  }
}
