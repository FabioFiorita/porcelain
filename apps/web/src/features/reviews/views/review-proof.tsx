import {
  publishedLabel,
  verdictSections,
  type ReviewRevision,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { ProofList } from './proof-list';
import { ReviewNotice } from './review-notice';

export function ReviewProof({
  revision,
  scope,
  context,
  current,
  title,
  columns = false,
}: {
  revision: ReviewRevision;
  scope: ReviewScope;
  context: ConnectionContext;
  current: boolean;
  title: string;
  columns?: boolean;
}) {
  const sections = verdictSections(revision);
  const empty =
    sections.proven.checks.length + sections.proven.assets.length === 0;
  const failures = sections.proven.checks.filter(
    (check) => check.result === 'fail',
  ).length;
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-3">
      <h3 className="border-b pb-2 text-sm font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">
        Published {publishedLabel(revision.publishedAt)} · at{' '}
        {sections.proven.shortHead}
      </p>
      {!current && !empty && (
        <ReviewNotice title="These checks ran before the latest changes">
          The code changed after the agent published this proof. Ask it to run
          the checks again.
        </ReviewNotice>
      )}
      {failures > 0 && (
        <div role="alert" className="text-sm text-destructive">
          <p>{failures} check failed</p>
          <p>The agent reported this work as not passing yet.</p>
        </div>
      )}
      <ProofList
        scope={scope}
        context={context}
        proof={revision.content.proof}
        layout={columns ? 'columns' : 'stacked'}
        layers={revision.content.layers}
      />
      {empty && (
        <p className="text-sm text-muted-foreground">No proof attached.</p>
      )}
    </section>
  );
}
