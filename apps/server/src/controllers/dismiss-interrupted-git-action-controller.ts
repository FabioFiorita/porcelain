import type { GitActionScope } from '@porcelain/git-actions/models';
import type { DismissInterruptedGitActionService } from '@porcelain/git-actions/services';
import type { Lanes } from '../runtime/operation-runner.ts';

export class DismissInterruptedGitActionController {
  private readonly lanes: Lanes;
  private readonly dismiss: DismissInterruptedGitActionService;

  constructor(lanes: Lanes, dismiss: DismissInterruptedGitActionService) {
    this.lanes = lanes;
    this.dismiss = dismiss;
  }

  execute(input: GitActionScope & { requestId: string }): { dismissed: true } {
    this.lanes.assertOpen();
    this.dismiss.execute(
      { projectId: input.projectId, worktreeId: input.worktreeId },
      input.requestId,
    );
    return { dismissed: true };
  }
}
