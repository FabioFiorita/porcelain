import type {
  GitActionScope,
  ListGitBranchesResponse,
} from '@porcelain/contracts/git-actions';
import type { ListGitBranchesService } from '@porcelain/git-actions/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ListGitBranchesController {
  private readonly listGitBranches: ListGitBranchesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listGitBranches: ListGitBranchesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listGitBranches = listGitBranches;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: GitActionScope,
    context: OperationContext,
  ): Promise<ListGitBranchesResponse> {
    return this.lanes.run(
      this.laneKeys.project(input.projectId),
      'read',
      ({ signal }) => this.listGitBranches.execute(input, signal),
      { callerSignal: context.signal },
    );
  }
}
