import type {
  GitActionScope,
  ListGitBranchesResponse,
} from '@porcelain/contracts/git-actions';
import type { ListGitBranchesService } from '@porcelain/git-actions/services';
import type {
  CheckProjectService,
  CheckWorktreeService,
} from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListGitBranchesUseCase {
  private readonly checkProject: CheckProjectService;
  private readonly checkWorktree: CheckWorktreeService;
  private readonly listGitBranches: ListGitBranchesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkProject: CheckProjectService,
    checkWorktree: CheckWorktreeService,
    listGitBranches: ListGitBranchesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkProject = checkProject;
    this.checkWorktree = checkWorktree;
    this.listGitBranches = listGitBranches;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: GitActionScope,
    context: OperationContext,
  ): Promise<ListGitBranchesResponse> {
    const { projectId, worktreeId } = input;
    return this.lanes.run(
      this.laneKeys.project(projectId),
      'read',
      async ({ signal }) => {
        this.checkProject.execute({ projectId });
        await this.checkWorktree.execute({ worktreeId, projectId }, signal);
        return this.listGitBranches.execute(input, signal);
      },
      { callerSignal: context.signal },
    );
  }
}
