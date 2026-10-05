import { Effect } from 'effect';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type {
  ListFilePreferencesParams,
  ListFilePreferencesResponse,
} from '@porcelain/contracts/projects';
import type {
  CheckProjectService,
  ListFilePreferencesService,
} from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class ListFilePreferencesUseCase {
  private readonly checkProject: CheckProjectService;
  private readonly listFilePreferences: ListFilePreferencesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkProject: CheckProjectService,
    listFilePreferences: ListFilePreferencesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkProject = checkProject;
    this.listFilePreferences = listFilePreferences;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: ListFilePreferencesParams,
  ): Effect.Effect<ListFilePreferencesResponse, ProjectNotFoundError> {
    return Effect.gen({ self: this }, function* () {
      const project = yield* this.checkProject.execute({
        projectId: input.projectId,
      });
      return yield* this.lanes.run(this.laneKeys.project(project), 'read', () =>
        this.listFilePreferences.execute(input),
      );
    });
  }
}
