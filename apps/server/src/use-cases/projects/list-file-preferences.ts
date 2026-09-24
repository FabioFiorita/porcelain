import type {
  ListFilePreferencesParams,
  ListFilePreferencesResponse,
} from '@porcelain/contracts/projects';
import type { ListFilePreferencesService } from '@porcelain/projects/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListFilePreferencesUseCase {
  private readonly listFilePreferences: ListFilePreferencesService;
  private readonly lanes: Lanes;

  constructor(listFilePreferences: ListFilePreferencesService, lanes: Lanes) {
    this.listFilePreferences = listFilePreferences;
    this.lanes = lanes;
  }

  execute(
    input: ListFilePreferencesParams,
    context: OperationContext,
  ): Promise<ListFilePreferencesResponse> {
    return this.lanes.unqueued(
      async () => this.listFilePreferences.execute(input),
      { callerSignal: context.signal },
    );
  }
}
