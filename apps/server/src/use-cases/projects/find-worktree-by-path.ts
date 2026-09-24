import type {
  FindWorktreeByPathRequest,
  FindWorktreeByPathResponse,
} from '@porcelain/contracts/projects';
import type {
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import { NoWorktreeAtPathError } from '@porcelain/projects/errors';
import { worktreeAtPath } from '@porcelain/projects/rules';
import type { JobWork } from '../../runtime/interval-job.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class FindWorktreeByPathUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly refreshInventory: JobWork;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    refreshInventory: JobWork,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.refreshInventory = refreshInventory;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: FindWorktreeByPathRequest,
    context: OperationContext,
  ): Promise<FindWorktreeByPathResponse> {
    const known = await this.known(input.path, context);
    if (known !== undefined) return { worktreeId: known };
    await this.refreshInventory.execute(context);
    const refreshed = await this.known(input.path, context);
    if (refreshed === undefined) throw new NoWorktreeAtPathError();
    return { worktreeId: refreshed };
  }

  private known(
    path: string,
    context: OperationContext,
  ): Promise<string | undefined> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () =>
        worktreeAtPath(
          path,
          this.listKnownWorktrees.execute(this.listRegisteredProjects.execute())
            .listings,
        ),
      { callerSignal: context.signal },
    );
  }
}
