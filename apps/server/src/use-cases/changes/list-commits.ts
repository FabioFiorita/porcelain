import type { ListCommitsService } from '@porcelain/changes/services';
import type {
  ListCommitsQuery,
  ListCommitsResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListCommitsUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly listCommits: ListCommitsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    listCommits: ListCommitsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listCommits = listCommits;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams & ListCommitsQuery,
    context: OperationContext,
  ): Promise<ListCommitsResponse> {
    const { worktreeId, limit, after, tip } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId },
      context.signal,
    );
    return this.lanes.run(
      this.laneKeys.repository(worktree),
      'read',
      async ({ signal }) => {
        const page = await this.listCommits.execute(
          { worktreeId, limit, after, tip },
          signal,
        );
        await this.checkWorktree.execute({ worktreeId }, signal);
        return page;
      },
      { callerSignal: context.signal },
    );
  }
}
