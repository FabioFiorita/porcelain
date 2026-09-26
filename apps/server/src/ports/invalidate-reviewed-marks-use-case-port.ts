import type { InvalidateReviewedMarksInput } from '@porcelain/reviews/models';
import type { OperationContext } from './operation-context.ts';

export interface InvalidateReviewedMarksUseCasePort {
  execute(
    input: InvalidateReviewedMarksInput,
    context: OperationContext,
  ): Promise<void>;
}
