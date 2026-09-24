import type {
  ResolveWorktreeByPathRequest,
  ResolveWorktreeByPathResponse,
} from '@porcelain/contracts/projects';
import type {
  FindWorktreeByPathService,
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ResolveWorktreeByPathUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listProjectWorktrees: ListProjectWorktreesService;
  private readonly findWorktreeByPath: FindWorktreeByPathService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listProjectWorktrees: ListProjectWorktreesService,
    findWorktreeByPath: FindWorktreeByPathService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listProjectWorktrees = listProjectWorktrees;
    this.findWorktreeByPath = findWorktreeByPath;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: ResolveWorktreeByPathRequest,
    context: OperationContext,
  ): Promise<ResolveWorktreeByPathResponse> {
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
        return this.findWorktreeByPath.execute({ path: input.path, listings });
      },
      { callerSignal: context.signal },
    );
  }
}
