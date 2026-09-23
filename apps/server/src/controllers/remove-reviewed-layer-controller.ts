import type { ListReviewedLayersResponse } from '@porcelain/contracts/reviews';
import { RemoveReviewedLayerService } from '@porcelain/reviews/services';
import type {
  ReviewWorktreeAccess,
  RunReviewWorktreeOperation,
} from '../runtime/review-worktree-operation.ts';

export class RemoveReviewedLayerController {
  private readonly worktrees: ReviewWorktreeAccess;
  private readonly remove: RemoveReviewedLayerService;
  private readonly run: RunReviewWorktreeOperation;
  private readonly publishChanged: (worktreeId: string) => void;

  constructor(
    worktrees: ReviewWorktreeAccess,
    remove: RemoveReviewedLayerService,
    run: RunReviewWorktreeOperation,
    publishChanged: (worktreeId: string) => void,
  ) {
    this.worktrees = worktrees;
    this.remove = remove;
    this.run = run;
    this.publishChanged = publishChanged;
  }

  execute(
    input: { worktreeId: string; layerId: string },
    context: { signal?: AbortSignal | undefined },
  ): Promise<ListReviewedLayersResponse> {
    return this.run(async (signal) => {
      await this.worktrees.forWriting(input.worktreeId, signal);
      return this.remove.execute(input.worktreeId, input.layerId);
    }, context.signal).then((answer) => {
      this.publishChanged(input.worktreeId);
      return answer;
    });
  }
}
