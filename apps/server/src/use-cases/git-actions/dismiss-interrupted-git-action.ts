import type {
  DismissInterruptedGitActionParams,
  DismissInterruptedGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type { DismissInterruptedGitActionService } from '@porcelain/git-actions/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { WorktreeCheck } from '../../runtime/worktree-check.ts';

export class DismissInterruptedGitActionUseCase {
  private readonly checkWorktree: WorktreeCheck;
  private readonly dismissInterruptedGitAction: DismissInterruptedGitActionService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: WorktreeCheck,
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

  async execute(
    input: DismissInterruptedGitActionParams,
    context: OperationContext,
  ): Promise<DismissInterruptedGitActionResponse> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId, requireAvailableProject: false },
      context,
    );
    const result = await this.lanes.run(
      this.laneKeys.receipts(worktree),
      'write',
      async () =>
        this.dismissInterruptedGitAction.execute({
          projectId: worktree.projectId,
          worktreeId: worktree.id,
          requestId: input.requestId,
        }),
      { callerSignal: context.signal },
    );
    if (result.kind === 'dismissed')
      this.events.gitActionChanged(result.receipt);
    return { dismissed: true };
  }
}
