import { Context, type Effect } from 'effect';
import type { ReviewLinkHosts } from '@porcelain/reviews/models';
export const ReviewLinkSource = Context.Service<
  '@porcelain/server/ReviewLinkSource',
  {
    read(): Effect.Effect<ReviewLinkHosts>;
  }
>('@porcelain/server/ReviewLinkSource');
