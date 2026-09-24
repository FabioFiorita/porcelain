import type { InvalidateReviewedMarksInput } from '@porcelain/reviews/models';
import type { OperationContext } from './operation-context.ts';

export type ReviewedMarksInvalidation = {
  execute(
    input: InvalidateReviewedMarksInput,
    context: OperationContext,
  ): Promise<unknown>;
};
