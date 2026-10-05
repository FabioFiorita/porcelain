import { Effect } from 'effect';
import type {
  CollectAbsentWorktreesService,
  ListExpiredWorktreesService,
} from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

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

  execute(): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const { worktrees } = yield* this.lanes.run(
        this.laneKeys.inventory(),
        'read',
        () => this.listExpiredWorktrees.execute(),
      );
      const collected: string[] = [];
      for (const worktree of worktrees) {
        const result = yield* this.lanes.run(
          this.laneKeys.repository(worktree),
          'write',
          () =>
            this.collectAbsentWorktrees.execute({ worktreeIds: [worktree.id] }),
        );
        collected.push(...result.collected);
      }
      if (collected.length > 0) this.events.inventoryChanged();
    });
  }
}
