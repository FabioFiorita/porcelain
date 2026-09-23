import type {
  DismissInterruptedGitActionParams,
  DismissInterruptedGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type { DismissInterruptedGitActionService } from '@porcelain/git-actions/services';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class DismissInterruptedGitActionController {
  private readonly dismissInterruptedGitAction: DismissInterruptedGitActionService;
  private readonly lanes: Lanes;

  constructor(
    dismissInterruptedGitAction: DismissInterruptedGitActionService,
    lanes: Lanes,
  ) {
    this.dismissInterruptedGitAction = dismissInterruptedGitAction;
    this.lanes = lanes;
  }

  execute(
    input: DismissInterruptedGitActionParams,
    context: OperationContext,
  ): DismissInterruptedGitActionResponse {
    context.signal?.throwIfAborted();
    this.lanes.assertOpen();
    this.dismissInterruptedGitAction.execute(input);
    return { dismissed: true };
  }
}
