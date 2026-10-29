import { refLabel } from '@porcelain/client/history/rules';
import {
  verdictSections,
  type DurableReviewRead,
  type ReviewRevision,
} from '@porcelain/client/reviews/rules';
import { CircleDashedIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { relativeTime } from '@/shared/lib/relative-time';
import { cn } from '@/shared/lib/utils';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { ReviewActions } from './review-actions';
import { marginAction } from './review-controls';

export function BriefingMargin({
  data,
  revision,
  context,
  onRevision,
  onDeleted,
  onBack,
}: {
  data: DurableReviewRead;
  revision: ReviewRevision;
  context: ConnectionContext;
  onRevision: ((revision: number | undefined) => void) | undefined;
  onDeleted: () => void;
  onBack: (() => void) | undefined;
}) {
  const sections = verdictSections(revision);
  const newest = data.review?.latestRevision ?? revision.revision;
  const revisions = [...data.revisions].sort(
    (left, right) => right.revision - left.revision,
  );
  return (
    <aside
      aria-label="Review details"
      className="flex min-w-0 flex-col gap-8 text-xs"
    >
      <section className="flex flex-col">
        <MarginHeading>Revisions</MarginHeading>
        <nav aria-label="Review revisions">
          <ol className="flex flex-col divide-y border-y">
            {revisions.map((entry) => {
              const isLatest = entry.revision === newest;
              const reading = entry.revision === revision.revision;
              return (
                <li key={entry.revision}>
                  <button
                    type="button"
                    aria-label={
                      isLatest
                        ? `Revision ${entry.revision}, the latest`
                        : `Revision ${entry.revision}`
                    }
                    aria-pressed={reading}
                    disabled={!onRevision}
                    onClick={() =>
                      onRevision?.(isLatest ? undefined : entry.revision)
                    }
                    className="flex h-7.5 w-full items-center gap-2 text-left text-xs leading-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 enabled:hover:bg-accent"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        isLatest && 'bg-brand',
                      )}
                    />
                    <span
                      className={cn(
                        'text-ui leading-4 tabular-nums',
                        reading ? 'font-semibold' : 'font-medium',
                      )}
                    >
                      r{entry.revision}
                    </span>
                    {isLatest && (
                      <span className="text-muted-foreground">Latest</span>
                    )}
                    <span className="ml-auto text-muted-foreground tabular-nums">
                      {relativeTime(entry.publishedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <p className="mt-2 leading-4.25 text-muted-foreground">
          An older revision opens as it was published. Comments carry across
          revisions.
        </p>
      </section>
      <section className="flex flex-col">
        <MarginHeading>This review</MarginHeading>
        <div className="flex flex-col border-t pt-2 leading-4.5">
          <p className="font-mono wrap-anywhere">
            {revision.branch} <span className="text-muted-foreground">→</span>{' '}
            {refLabel(revision.base)}
          </p>
          <p className="text-muted-foreground wrap-anywhere">
            Head{' '}
            <span className="font-mono text-foreground">
              {sections.header.shortHead}
            </span>{' '}
            · {relativeTime(revision.publishedAt)}
          </p>
          {data.review?.state === 'closed' && (
            <p className="text-muted-foreground">Closed</p>
          )}
        </div>
        <div className="mt-2.5 flex flex-col items-start">
          {onBack && (
            <button type="button" className={marginAction} onClick={onBack}>
              Back to workspace
            </button>
          )}
          <ReviewActions
            reviewId={revision.reviewId}
            state={data.review?.state ?? 'open'}
            context={context}
            onDeleted={onDeleted}
          />
        </div>
      </section>
    </aside>
  );
}

function MarginHeading({
  children,
  count,
}: {
  children: ReactNode;
  count?: ReactNode;
}) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-xs leading-4 font-medium text-muted-foreground">
      {children}
      {count !== undefined && (
        <span className="ml-auto tabular-nums">{count}</span>
      )}
    </h3>
  );
}

export function BriefingRemoved({ revision }: { revision: ReviewRevision }) {
  const sections = verdictSections(revision);
  if (sections.removed.fileCount === 0 && sections.removed.groups.length === 0)
    return null;
  return (
    <section aria-label="Removed" className="flex min-w-0 flex-col text-xs">
      <MarginHeading
        count={`${sections.removed.fileCount} ${sections.removed.fileCount === 1 ? 'file' : 'files'}`}
      >
        Removed
      </MarginHeading>
      <div className="flex flex-col divide-y border-y">
        {sections.removed.groups.map((group, index) => (
          <div key={index} className="flex flex-col gap-2 py-2 wrap-anywhere">
            <RemovedPaths paths={group.paths} />
            <p className="text-ui leading-4.75">
              <strong className="font-medium">{group.behavior}</strong> ·{' '}
              {group.why}
            </p>
          </div>
        ))}
        {sections.removed.unexplainedPaths.length > 0 && (
          <div className="flex flex-col gap-2 py-2">
            <RemovedPaths paths={sections.removed.unexplainedPaths} />
            <p className="text-destructive">No removal explanation supplied</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function BriefingNotProven({ revision }: { revision: ReviewRevision }) {
  const sections = verdictSections(revision);
  return (
    <section aria-label="Not proven" className="flex min-w-0 flex-col text-xs">
      <MarginHeading count={sections.notProven.length}>
        Not proven
      </MarginHeading>
      {sections.notProven.length === 0 ? (
        <p className="border-t pt-2 text-muted-foreground">Nothing listed.</p>
      ) : (
        <ul className="flex flex-col divide-y border-y">
          {sections.notProven.map((item, index) => (
            <li key={index} className="flex gap-1.5 py-2 wrap-anywhere">
              <CircleDashedIcon
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
              />
              <span className="flex min-w-0 flex-col">
                <strong className="text-ui leading-4.5 font-medium">
                  {item.what}
                </strong>
                <span className="leading-4.25 text-muted-foreground">
                  {item.why}
                </span>
              </span>
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
