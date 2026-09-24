import type {
  GitActionScope,
  ListGitBranchesResponse,
} from '@porcelain/contracts/git-actions';
import type { ListGitBranchesService } from '@porcelain/git-actions/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { WorktreeCheck } from '../../runtime/worktree-check.ts';

export class ListGitBranchesUseCase {
  private readonly checkWorktree: WorktreeCheck;
  private readonly listGitBranches: ListGitBranchesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: WorktreeCheck,
    listGitBranches: ListGitBranchesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listGitBranches = listGitBranches;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: GitActionScope,
    context: OperationContext,
  ): Promise<ListGitBranchesResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        return this.listGitBranches.execute(
          { projectId: worktree.projectId, worktreeId },
          signal,
        );
      },
      { callerSignal: context.signal },
    );
  }
}
