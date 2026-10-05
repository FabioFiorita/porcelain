import { Effect } from 'effect';
import type { RenameEnvironmentService } from '@porcelain/access/services';
import type {
  RenameEnvironmentRequest,
  RenameEnvironmentResponse,
} from '@porcelain/contracts/access';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RenameEnvironmentUseCase {
  private readonly renameEnvironment: RenameEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    renameEnvironment: RenameEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.renameEnvironment = renameEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  execute(
    input: RenameEnvironmentRequest,
  ): Effect.Effect<RenameEnvironmentResponse> {
    return this.lanes.commit(
      this.laneKeys.access(),
      () =>
        Effect.uninterruptible(
          this.renameEnvironment.execute({ name: input.name ?? undefined }),
        ),
      () => Effect.sync(() => this.events.inventoryChanged()),
    );
  }
}
