import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Link } from '@tanstack/react-router';
import { readProjectReviews, readReview } from '@porcelain/client/reviews';
import type { ReviewRecord } from '@porcelain/client/reviews/rules';
import type { Connection } from '@/shared/workspace/connection';
import { useSidebar } from '@/components/ui/sidebar';

export function ProjectReviews({
  connection,
  projectId,
  environmentId,
}: {
  connection: Connection;
  projectId: string;
  environmentId: string | null;
}) {
  const result = useAtomValue(readProjectReviews({ connection, projectId }));
  const reviews = Option.getOrUndefined(AsyncResult.value(result));
  return (
    <section aria-label="Project reviews" className="ml-5 border-l pl-2">
      <h4 className="px-2 py-1 text-xs font-medium text-muted-foreground">
        Reviews
      </h4>
      {AsyncResult.isInitial(result) && (
        <p role="status" className="px-2 text-xs">
          Loading reviews…
        </p>
      )}
      {AsyncResult.isFailure(result) && (
        <p role="status" className="px-2 text-xs">
          Reviews could not be read.
        </p>
      )}
      {reviews?.length === 0 && (
        <p className="px-2 pb-2 text-xs text-muted-foreground">
          No reviews yet.
        </p>
      )}
      <ul>
        {[...(reviews ?? [])]
          .sort(
            (a, b) =>
              Number(a.state === 'closed') - Number(b.state === 'closed'),
          )
          .map((review) => (
            <ProjectReviewRow
              key={review.reviewId}
              connection={connection}
              review={review}
              environmentId={environmentId}
            />
          ))}
      </ul>
    </section>
  );
}
function ProjectReviewRow({
  connection,
  review,
  environmentId,
}: {
  connection: Connection;
  review: ReviewRecord;
  environmentId: string | null;
}) {
  const { setOpenMobile } = useSidebar();
  const result = useAtomValue(
    readReview({ connection, reviewId: review.reviewId }),
  );
  const data = Option.getOrUndefined(AsyncResult.value(result));
  const recommendation = data?.revision
    ? data.revision.verdict.recommendation
    : undefined;
  const label =
    recommendation === undefined
      ? '…'
      : recommendation[0]?.toUpperCase() + recommendation.slice(1);
  return (
    <li>
      <Link
        to="/reviews/$reviewId"
        params={{ reviewId: review.reviewId }}
        search={{
          environment: environmentId ?? undefined,
          decision: undefined,
        }}
        onClick={() => setOpenMobile(false)}
        className="flex min-w-0 flex-col gap-0.5 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
      >
        <span className="truncate font-medium">
          {review.pullRequest
            ? `PR #${review.pullRequest.split('/').filter(Boolean).at(-1)}`
            : review.branch}
        </span>
        <span className="text-muted-foreground">
          r{review.latestRevision} · {label} · {review.state}
        </span>
      </Link>
    </li>
  );
}
