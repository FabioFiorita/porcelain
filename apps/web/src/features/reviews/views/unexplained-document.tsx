import type { DocumentInteraction } from '../rules/documents';
import { spansLabel } from '../rules/patch-focus';
import {
  notExplainedLabel,
  type ReviewResponse,
  type ReviewScope,
} from '../rules/review';
import { ActiveReview } from './active-review';
import { DocumentToolbar } from './document-toolbar';
import { ReviewCodeDocument } from './review-code-document';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function UnexplainedDocument({
  scope,
  context,
  interaction,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
}) {
  return (
    <ActiveReview
      scope={scope}
      context={context}
      absent="Not explained lists the code a review leaves out. This worktree has no review now."
    >
      {(review) => (
        <UnexplainedCode
          scope={scope}
          context={context}
          interaction={interaction}
          review={review}
        />
      )}
    </ActiveReview>
  );
}

function UnexplainedCode({
  scope,
  context,
  interaction,
  review,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  review: ReviewResponse;
}) {
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
