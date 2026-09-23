import type { ReviewScope } from '../../domain/review';
import { notExplainedLabel } from '../../domain/review';
import { usePublishedReview } from '../../query/published-review';
import { DocumentToolbar } from './document-toolbar';
import { spansLabel } from './patch-focus';
import { ReviewCodeDocument } from './review-code-document';
import { ReviewEmpty } from './review-empty';

export function UnexplainedDocument({ scope }: { scope: ReviewScope }) {
  const published = usePublishedReview(scope);
  const review = published.data?.active ? published.data : null;
  if (published.isPending)
    return (
      <p role="status" className="p-4 text-sm">
        Loading review…
      </p>
    );
  if (!review)
    return (
      <ReviewEmpty
        title="No review here"
        description="Not explained lists the code a review leaves out. This worktree has no review now."
      />
    );
  const gaps = review.notExplained;
  const focus = Object.fromEntries(
    gaps
      .filter(
        (gap) =>
          gap.binary !== true && gap.deleted !== true && gap.ranges.length > 0,
      )
      .map((gap) => [gap.path, gap.ranges]),
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewCodeDocument
        scope={scope}
        paths={gaps.map((gap) => gap.path)}
        files={gaps.map((gap) => ({
          path: gap.path,
          note:
            gap.binary === true
              ? 'Binary change'
              : gap.deleted === true || gap.ranges.length === 0
                ? 'Deleted'
                : spansLabel(gap.ranges),
        }))}
        focus={focus}
        toolbar={(collapseControl) => (
          <DocumentToolbar
            title="Not explained"
            subtitle={
              notExplainedLabel(gaps) ?? 'Every changed line is explained'
            }
          >
            {collapseControl}
          </DocumentToolbar>
        )}
      />
    </div>
  );
}
