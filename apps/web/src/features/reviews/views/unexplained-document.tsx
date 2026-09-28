import { usePublishedReview } from '../queries/published-review';
import type { DocumentInteraction } from '../rules/documents';
import { spansLabel } from '../rules/patch-focus';
import { notExplainedLabel, type ReviewScope } from '../rules/review';
import type { DocumentContext } from './code-document';
import { DocumentToolbar } from './document-toolbar';
import { ReviewCodeDocument } from './review-code-document';
import { ReviewEmpty } from './review-empty';

export function UnexplainedDocument({
  scope,
  context,
  interaction,
}: {
  scope: ReviewScope;
  context: DocumentContext;
  interaction: DocumentInteraction;
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
        context={context}
        interaction={interaction}
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
