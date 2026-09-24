import type {
  FindWorktreeByPathRequest,
  FindWorktreeByPathResponse,
} from '@porcelain/contracts/projects';
import type {
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import { NoWorktreeAtPathError } from '@porcelain/projects/errors';
import { worktreeAtPath } from '@porcelain/projects/rules';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class FindWorktreeByPathUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listProjectWorktrees: ListProjectWorktreesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listProjectWorktrees: ListProjectWorktreesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listProjectWorktrees = listProjectWorktrees;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: FindWorktreeByPathRequest,
    context: OperationContext,
  ): Promise<FindWorktreeByPathResponse> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async ({ signal }) => {
        const { projects } = this.listRegisteredProjects.execute();
        const listings = await Promise.all(
          projects.map((project) =>
            this.listProjectWorktrees.execute({ project }, signal),
          ),
        );
        const worktreeId = worktreeAtPath(input.path, listings);
        if (worktreeId === undefined) throw new NoWorktreeAtPathError();
        return { worktreeId };
      },
      { callerSignal: context.signal },
    );
  }
}
