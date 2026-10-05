import { Effect } from 'effect';
import type { NoWorktreeAtPathError } from '@porcelain/projects/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
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
import type { JobRunner } from '../../ports/job-runner.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class FindWorktreeByPathUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly findWorktreeAtPath: FindWorktreeAtPathService;
  private readonly refreshInventory: JobRunner<ProjectNotFoundError>;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    findWorktreeAtPath: FindWorktreeAtPathService,
    refreshInventory: JobRunner<ProjectNotFoundError>,
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

  execute(
    input: FindWorktreeByPathRequest,
  ): Effect.Effect<
    FindWorktreeByPathResponse,
    NoWorktreeAtPathError | ProjectNotFoundError
  > {
    return Effect.gen({ self: this }, function* () {
      const known = yield* this.listings();
      const worktreeId = worktreeAtPath(input.path, known);
      if (worktreeId !== undefined) return { worktreeId };
      yield* this.refreshInventory.execute();
      return yield* this.findWorktreeAtPath.execute({
        path: input.path,
        listings: yield* this.listings(),
      });
    });
  }

  private listings(): Effect.Effect<ProjectWorktrees[]> {
    return this.lanes.run(this.laneKeys.inventory(), 'read', () =>
      Effect.gen({ self: this }, function* () {
        const inventory = yield* this.listRegisteredProjects.execute();
        return (yield* this.listKnownWorktrees.execute(inventory)).listings;
      }),
    );
  }
}
