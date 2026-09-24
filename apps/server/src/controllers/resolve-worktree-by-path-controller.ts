import type {
  ResolveWorktreeByPathRequest,
  ResolveWorktreeByPathResponse,
} from '@porcelain/contracts/projects';
import type {
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
  ResolveWorktreeByPathService,
} from '@porcelain/projects/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ResolveWorktreeByPathController {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listProjectWorktrees: ListProjectWorktreesService;
  private readonly resolveWorktreeByPath: ResolveWorktreeByPathService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listProjectWorktrees: ListProjectWorktreesService,
    resolveWorktreeByPath: ResolveWorktreeByPathService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listProjectWorktrees = listProjectWorktrees;
    this.resolveWorktreeByPath = resolveWorktreeByPath;
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
        return this.resolveWorktreeByPath.execute({
          path: input.path,
          listings,
        });
      },
      { callerSignal: context.signal },
    );
  }
}
