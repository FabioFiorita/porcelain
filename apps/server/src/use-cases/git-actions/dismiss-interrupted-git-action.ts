import type {
  DismissInterruptedGitActionParams,
  DismissInterruptedGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type { DismissInterruptedGitActionService } from '@porcelain/git-actions/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class DismissInterruptedGitActionUseCase {
  private readonly dismissInterruptedGitAction: DismissInterruptedGitActionService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    dismissInterruptedGitAction: DismissInterruptedGitActionService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.dismissInterruptedGitAction = dismissInterruptedGitAction;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: DismissInterruptedGitActionParams,
  ): Promise<DismissInterruptedGitActionResponse> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async (): Promise<DismissInterruptedGitActionResponse> => {
        this.dismissInterruptedGitAction.execute(input);
        return { dismissed: true };
      },
    );
  }
}
