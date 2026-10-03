import type {
  FindWorktreeByPathRequest,
  FindWorktreeByPathResponse,
} from '@porcelain/contracts/projects';
import type { ProjectWorktrees } from '@porcelain/projects/models';
import type {
  FindWorktreeAtPathService,
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import { worktreeAtPath } from '@porcelain/projects/rules';
import type { JobWork } from '../../ports/job-work.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class FindWorktreeByPathUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly findWorktreeAtPath: FindWorktreeAtPathService;
  private readonly refreshInventory: JobWork;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    findWorktreeAtPath: FindWorktreeAtPathService,
    refreshInventory: JobWork,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.findWorktreeAtPath = findWorktreeAtPath;
    this.refreshInventory = refreshInventory;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: FindWorktreeByPathRequest,
    context: OperationContext,
  ): Promise<FindWorktreeByPathResponse> {
    const known = await this.listings(context);
    const worktreeId = worktreeAtPath(input.path, known);
    if (worktreeId !== undefined) return { worktreeId };
    await this.refreshInventory.execute(context);
    return this.findWorktreeAtPath.execute({
      path: input.path,
      listings: await this.listings(context),
    });
  }

  private listings(context: OperationContext): Promise<ProjectWorktrees[]> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () =>
        this.listKnownWorktrees.execute(this.listRegisteredProjects.execute())
          .listings,
      { callerSignal: context.signal },
    );
  }
}
