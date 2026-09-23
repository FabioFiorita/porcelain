import type { ReviewedLayerMarksResponse } from '@porcelain/contracts/reviews';
import { ListReviewedLayersService } from '@porcelain/reviews/services';
import type {
  ReviewWorktreeAccess,
  RunReviewWorktreeOperation,
} from '../runtime/review-worktree-operation.ts';

export class ListReviewedLayersController {
  private readonly worktrees: ReviewWorktreeAccess;
  private readonly list: ListReviewedLayersService;
  private readonly run: RunReviewWorktreeOperation;

  constructor(
    worktrees: ReviewWorktreeAccess,
    list: ListReviewedLayersService,
    run: RunReviewWorktreeOperation,
  ) {
    this.worktrees = worktrees;
    this.list = list;
    this.run = run;
  }

  execute(
    input: { worktreeId: string },
    context: { signal?: AbortSignal | undefined },
  ): Promise<ReviewedLayerMarksResponse> {
    return this.run(async (signal) => {
      await this.worktrees.known(input.worktreeId, signal);
      return this.list.execute(input.worktreeId);
    }, context.signal);
  }
}
