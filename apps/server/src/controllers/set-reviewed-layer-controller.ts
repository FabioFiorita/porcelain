import type {
  ListReviewedLayersResponse,
  SetReviewedLayerRequest,
} from '@porcelain/contracts/reviews';
import { SetReviewedLayerService } from '@porcelain/reviews/services';
import type {
  ReviewWorktreeAccess,
  RunReviewWorktreeOperation,
} from '../runtime/review-worktree-operation.ts';

export class SetReviewedLayerController {
  private readonly worktrees: ReviewWorktreeAccess;
  private readonly set: SetReviewedLayerService;
  private readonly run: RunReviewWorktreeOperation;
  private readonly publishChanged: (worktreeId: string) => void;

  constructor(
    worktrees: ReviewWorktreeAccess,
    set: SetReviewedLayerService,
    run: RunReviewWorktreeOperation,
    publishChanged: (worktreeId: string) => void,
  ) {
    this.worktrees = worktrees;
    this.set = set;
    this.run = run;
    this.publishChanged = publishChanged;
  }

  execute(
    input: { worktreeId: string } & SetReviewedLayerRequest,
    context: { signal?: AbortSignal | undefined },
  ): Promise<ListReviewedLayersResponse> {
    return this.run(async (signal) => {
      await this.worktrees.forWriting(input.worktreeId, signal);
      return this.set.execute(input.worktreeId, input);
    }, context.signal).then((answer) => {
      this.publishChanged(input.worktreeId);
      return answer;
    });
  }
}
