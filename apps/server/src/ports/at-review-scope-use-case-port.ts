import type { Effect } from 'effect';
import type { ReviewScope } from '@porcelain/contracts/reviews';

export type AtReviewScopeExecution<Request, Result, Failure> = {
  cwd: string;
  reviewId?: string | undefined;
  request: Request;
  operation: {
    readonly execute: (
      input: Request & ReviewScope,
    ) => Effect.Effect<Result, Failure>;
  };
};
