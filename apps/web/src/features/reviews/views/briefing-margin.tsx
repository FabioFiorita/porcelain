import { refLabel } from '@porcelain/client/history/rules';
import {
  publishedLabel,
  verdictSections,
  type DurableReviewRead,
  type ReviewRevision,
} from '@porcelain/client/reviews/rules';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { ReviewActions } from './review-actions';

export function BriefingMargin({
  data,
  revision,
  latest,
  context,
  onRevision,
  onDeleted,
  onBack,
}: {
  data: DurableReviewRead;
  revision: ReviewRevision;
  latest: boolean;
  context: ConnectionContext;
  onRevision: ((revision: number | undefined) => void) | undefined;
  onDeleted: () => void;
  onBack: (() => void) | undefined;
}) {
  const sections = verdictSections(revision);
  return (
    <aside
      aria-label="Review details"
      className="flex min-w-0 flex-col gap-8 text-xs"
    >
      <section className="flex flex-col gap-2">
        <h3 className="border-b pb-2 font-medium text-muted-foreground">
          Revisions
        </h3>
        <nav aria-label="Review revisions" className="flex flex-wrap gap-1">
          {data.revisions.map((entry) => (
            <Button
              key={entry.revision}
              size="xs"
              variant={
                entry.revision === revision.revision ? 'secondary' : 'ghost'
              }
              aria-pressed={entry.revision === revision.revision}
              disabled={!onRevision}
              onClick={() => onRevision?.(entry.revision)}
            >
              r{entry.revision}
            </Button>
          ))}
          <Button
            size="xs"
            variant={latest ? 'secondary' : 'ghost'}
            aria-pressed={latest}
            disabled={!onRevision}
            onClick={() => onRevision?.(undefined)}
          >
            latest
          </Button>
        </nav>
        <p className="text-muted-foreground">
          An older revision opens as it was published. Comments carry across
          revisions.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="border-b pb-2 font-medium text-muted-foreground">
          This review
        </h3>
        <Badge variant="outline">{data.review?.state ?? 'open'}</Badge>
        {data.review?.pullRequest && (
          <a
            href={data.review.pullRequest}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            PR #{data.review.pullRequest.split('/').filter(Boolean).at(-1)}
          </a>
        )}
        <p className="font-mono wrap-anywhere">
          {revision.branch} → {refLabel(revision.base)}
        </p>
        <p className="wrap-anywhere">
          Head {sections.header.shortHead} ·{' '}
          {publishedLabel(revision.publishedAt)}
        </p>
        {onBack && (
          <Button
            variant="ghost"
            size="xs"
            className="self-start"
            onClick={onBack}
          >
            Back to workspace
          </Button>
        )}
        <ReviewActions
          reviewId={revision.reviewId}
          state={data.review?.state ?? 'open'}
          context={context}
          onDeleted={onDeleted}
        />
      </section>
    </aside>
  );
}
export function BriefingRemoved({ revision }: { revision: ReviewRevision }) {
  const sections = verdictSections(revision);
  if (sections.removed.fileCount === 0 && sections.removed.groups.length === 0)
    return null;
  return (
    <section
      aria-label="Removed"
      className="flex min-w-0 flex-col gap-3 text-xs"
    >
      <h3 className="border-b pb-2 font-medium text-muted-foreground">
        Removed · {sections.removed.fileCount}{' '}
        {sections.removed.fileCount === 1 ? 'file' : 'files'}
      </h3>
      {sections.removed.groups.map((group, index) => (
        <div key={index} className="flex flex-col gap-2 wrap-anywhere">
          <p>
            <strong>{group.behavior}</strong> · {group.why}
          </p>
          <RemovedPaths paths={group.paths} />
        </div>
      ))}
      {sections.removed.unexplainedPaths.length > 0 && (
        <div>
          <p className="text-destructive">No removal explanation supplied</p>
          <RemovedPaths paths={sections.removed.unexplainedPaths} />
        </div>
      )}
    </section>
  );
}
export function BriefingNotProven({ revision }: { revision: ReviewRevision }) {
  const sections = verdictSections(revision);
  return (
    <section
      aria-label="Not proven"
      className="flex min-w-0 flex-col gap-2 text-xs"
    >
      <h3 className="border-b pb-2 font-medium text-muted-foreground">
        Not proven
      </h3>
      {sections.notProven.length === 0 ? (
        <p className="text-muted-foreground">Nothing listed.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {sections.notProven.map((item, index) => (
            <li key={index} className="py-2 wrap-anywhere">
              <strong>{item.what}</strong>
              <p className="text-muted-foreground"> · {item.why}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function RemovedPaths({ paths }: { paths: readonly string[] }) {
  return (
    <ul className="space-y-1 font-mono text-xs wrap-anywhere text-destructive">
      {paths.map((path) => (
        <li key={path} className="flex min-w-0 gap-1">
          <span>{'− '}</span>
          <span className="min-w-0 wrap-anywhere">{path}</span>
        </li>
      ))}
    </ul>
  );
}
