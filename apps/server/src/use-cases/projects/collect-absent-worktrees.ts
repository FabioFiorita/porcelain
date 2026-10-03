import type {
  CollectAbsentWorktreesService,
  ListExpiredWorktreesService,
} from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class CollectAbsentWorktreesUseCase {
  private readonly listExpiredWorktrees: ListExpiredWorktreesService;
  private readonly collectAbsentWorktrees: CollectAbsentWorktreesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    listExpiredWorktrees: ListExpiredWorktreesService,
    collectAbsentWorktrees: CollectAbsentWorktreesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.listExpiredWorktrees = listExpiredWorktrees;
    this.collectAbsentWorktrees = collectAbsentWorktrees;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(context: OperationContext): Promise<void> {
    const { worktrees } = await this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () => this.listExpiredWorktrees.execute(),
      { callerSignal: context.signal },
    );
    const collected: string[] = [];
    for (const worktree of worktrees) {
      const result = await this.lanes.run(
        this.laneKeys.repository(worktree),
        'write',
        async () =>
          this.collectAbsentWorktrees.execute({ worktreeIds: [worktree.id] }),
        { callerSignal: context.signal },
      );
      collected.push(...result.collected);
    }
    if (collected.length > 0) this.events.inventoryChanged();
  }
}
