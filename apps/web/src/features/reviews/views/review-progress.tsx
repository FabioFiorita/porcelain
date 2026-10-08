import { Button } from '@/components/ui/button';
import {
  reviewCoverage,
  type ReviewResponse,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { useReviewUnderstanding } from '../queries/understanding';
import type { OpenDocument } from '../rules/documents';

export function ReviewProgress({
  review,
  scope,
  context,
  onOpen,
}: {
  review: ReviewResponse;
  scope: ReviewScope;
  context: ConnectionContext;
  onOpen: OpenDocument;
}) {
  const progress = useReviewUnderstanding(scope, context, review.layers);
  const coverage = reviewCoverage(review);
  return (
    <div
      aria-label="Review progress"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3.5 py-2 text-xs"
    >
      <span role="status" className="tabular-nums">
        {progress.failed
          ? 'Review progress unavailable'
          : progress.pending
            ? 'Refreshing progress…'
            : `${progress.reviewed} of ${review.layers.length} walkthroughs reviewed · ${progress.remaining} left`}
      </span>
      {!coverage.available ? (
        <span>Coverage unavailable</span>
      ) : (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onOpen({ kind: 'unexplained' })}
        >
          {coverage.gaps > 0
            ? `${coverage.gaps} ${coverage.gaps === 1 ? 'file has' : 'files have'} unexplained changes`
            : 'No unexplained changes'}
        </Button>
      )}
      {coverage.stale > 0 && (
        <span className="text-graph-4">
          {coverage.stale} code{' '}
          {coverage.stale === 1 ? 'location' : 'locations'} changed
        </span>
      )}
    </div>
  );
}
