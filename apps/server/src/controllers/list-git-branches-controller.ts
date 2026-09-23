import type {
  GitActionScope,
  GitBranches,
} from '@porcelain/git-actions/models';
import type { ListGitBranchesService } from '@porcelain/git-actions/services';
import type { Lanes } from '../runtime/lanes.ts';

export class ListGitBranchesController {
  private readonly lanes: Lanes;
  private readonly laneFor: (projectId: string) => string;
  private readonly list: ListGitBranchesService;

  constructor(
    lanes: Lanes,
    laneFor: (projectId: string) => string,
    list: ListGitBranchesService,
  ) {
    this.lanes = lanes;
    this.laneFor = laneFor;
    this.list = list;
  }

  execute(scope: GitActionScope, signal?: AbortSignal): Promise<GitBranches> {
    return this.lanes.run(
      this.laneFor(scope.projectId),
      'read',
      ({ signal: operationSignal }) =>
        this.list.execute(scope, operationSignal),
      { callerSignal: signal },
    );
  }
}
