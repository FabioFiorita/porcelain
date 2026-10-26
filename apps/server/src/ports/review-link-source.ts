import { Context, type Effect } from 'effect';
import type { ReviewLinkRoutes } from '@porcelain/reviews/models';
export const ReviewLinkSource = Context.Service<
  '@porcelain/server/ReviewLinkSource',
  {
    read(): Effect.Effect<ReviewLinkRoutes>;
  }
>('@porcelain/server/ReviewLinkSource');
