import type {
  ListFilePreferencesParams,
  ListFilePreferencesResponse,
} from '@porcelain/contracts/projects';
import type { ListFilePreferencesService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListFilePreferencesUseCase {
  private readonly listFilePreferences: ListFilePreferencesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listFilePreferences: ListFilePreferencesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listFilePreferences = listFilePreferences;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: ListFilePreferencesParams,
    context: OperationContext,
  ): Promise<ListFilePreferencesResponse> {
    return this.lanes.run(
      this.laneKeys.project(input.projectId),
      'read',
      async () => this.listFilePreferences.execute(input),
      { callerSignal: context.signal },
    );
  }
}
