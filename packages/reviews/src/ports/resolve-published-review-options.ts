import { Context } from 'effect';
import type { ResolvePublishedReviewOptions as ResolvePublishedReviewOptionsShape } from '../models/resolve-published-review.ts';
export const ResolvePublishedReviewOptions = Context.Service<
  '@porcelain/reviews/ResolvePublishedReviewOptions',
  ResolvePublishedReviewOptionsShape
>('@porcelain/reviews/ResolvePublishedReviewOptions');
