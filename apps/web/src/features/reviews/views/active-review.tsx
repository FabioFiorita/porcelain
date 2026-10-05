import type { ReactNode } from 'react';
import { usePublishedReview } from '../queries/published-review';
import type {
  ReviewResponse,
  ReviewScope,
} from '@porcelain/client/reviews/rules';
import { ReviewEmpty } from './review-empty';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function ActiveReview({
  scope,
  context,
  absent,
  children,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  absent: string;
  children: (review: ReviewResponse) => ReactNode;
}) {
  const published = usePublishedReview(scope, context);
  const review = published.data?.active ? published.data : null;
  if (published.isPending)
    return (
      <p role="status" className="p-4 text-sm">
        Loading review…
      </p>
    );
  if (!review)
    return <ReviewEmpty title="No review here" description={absent} />;
  return children(review);
}
