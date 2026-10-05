import { Effect } from 'effect';
import type {
  DismissInterruptedGitActionParams,
  DismissInterruptedGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type { DismissInterruptedGitActionService } from '@porcelain/git-actions/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class DismissInterruptedGitActionUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly dismissInterruptedGitAction: DismissInterruptedGitActionService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    dismissInterruptedGitAction: DismissInterruptedGitActionService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.dismissInterruptedGitAction = dismissInterruptedGitAction;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  execute(
    input: DismissInterruptedGitActionParams,
  ): Effect.Effect<
    DismissInterruptedGitActionResponse,
    | Effect.Error<ReturnType<CheckWorktreeUseCasePort['execute']>>
    | Effect.Error<ReturnType<DismissInterruptedGitActionService['execute']>>
  > {
    return Effect.gen({ self: this }, function* () {
      const worktree = yield* this.checkWorktree.execute({
        worktreeId: input.worktreeId,
        requireAvailableProject: false,
      });
      return yield* this.lanes
        .commit(
          this.laneKeys.receipts(worktree),
          () =>
            Effect.uninterruptible(
              this.dismissInterruptedGitAction.execute({
                projectId: worktree.projectId,
                worktreeId: worktree.id,
                requestId: input.requestId,
              }),
            ),
          (result) =>
            Effect.sync(() => {
              if (result.kind === 'dismissed')
                this.events.gitActionChanged(result.receipt);
            }),
        )
        .pipe(Effect.as({ dismissed: true as const }));
    });
  }
}
