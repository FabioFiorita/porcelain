import type { ListFileCommitsService } from '@porcelain/changes/services';
import type {
  ListFileCommitsQuery,
  ListFileCommitsResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ListFileCommitsUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly listFileCommits: ListFileCommitsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    listFileCommits: ListFileCommitsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listFileCommits = listFileCommits;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams & ListFileCommitsQuery,
    context: OperationContext,
  ): Promise<ListFileCommitsResponse> {
    const { worktreeId, path, limit } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const listed = await this.listFileCommits.execute(
          { worktreeId, path, limit },
          signal,
        );
        return listed;
      },
      { callerSignal: context.signal },
    );
  }
}
