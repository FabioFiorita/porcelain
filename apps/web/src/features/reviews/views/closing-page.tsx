import {
  ArchiveIcon,
  ArrowRightIcon,
  CircleCheckIcon,
  CircleIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { spansLabel } from '@porcelain/client/changes/rules';
import {
  filesReviewed,
  type reviewListStatus,
  stopTitle,
  threadState,
  verdictSections,
  type CommentThread,
  type DurableReviewRead,
  type ReviewChangeItem,
  type ReviewRevision,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { Button, buttonVariants } from '@/components/ui/button';
import { ArchiveReview } from '@/features/projects/index';
import { cn } from '@/shared/lib/utils';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { InlineComposer } from './inline-composer';
import { MarginRow } from './margin-row';
import type { WalkthroughProps } from './walkthrough-props';

type ClosingStop = Extract<
  WalkthroughStop,
  { kind: 'unexplained' } | { kind: 'specs' }
>;
type CompletionStatus = Pick<
  ReturnType<typeof reviewListStatus>,
  'group' | 'reviewed' | 'total'
>;
type CompletionGroup = CompletionStatus['group'];
type LinkedPullRequest = { number: number; url: string; state: string };

export function ClosingPage({
  stops,
  current,
  revision,
  record,
  items,
  threads,
  pullRequest,
  archivable,
  status,
  scope,
  context,
  onGo,
  code,
}: {
  stops: readonly WalkthroughStop[];
  current: ClosingStop;
  revision: ReviewRevision;
  record: DurableReviewRead['review'];
  items: readonly Pick<ReviewChangeItem, 'path' | 'reviewStatus'>[];
  threads: readonly CommentThread[];
  pullRequest: LinkedPullRequest | undefined;
  archivable: boolean;
  status: CompletionStatus;
  scope: WalkthroughProps['scope'];
  context: ConnectionContext;
  onGo: (key: WalkthroughKey) => void;
  code: (stop: ClosingStop) => ReactNode;
}) {
  const unexplained = stops.find(
    (stop): stop is Extract<ClosingStop, { kind: 'unexplained' }> =>
      stop.kind === 'unexplained',
  );
  const specs = stops.find(
    (stop): stop is Extract<ClosingStop, { kind: 'specs' }> =>
      stop.kind === 'specs',
  );
  const [scrolled, setScrolled] = useState<WalkthroughKey>();
  const target = (key: WalkthroughKey) => (node: HTMLElement | null) => {
    if (!node || key !== current.key || scrolled === key) return;
    setScrolled(key);
    if (key === 'specs' && unexplained) node.scrollIntoView({ block: 'start' });
  };
  return (
    <MarginRow
      margin={
        <aside
          aria-label="Completion"
          className="min-w-0 @5xl/review:sticky @5xl/review:top-4 @5xl/review:self-start"
        >
          <CompletionCard
            stops={stops}
            revision={revision}
            record={record}
            items={items}
            threads={threads}
            pullRequest={pullRequest}
            archivable={archivable}
            status={status}
            scope={scope}
            context={context}
          />
        </aside>
      }
    >
      <div className="flex min-w-0 flex-col gap-12">
        {unexplained && (
          <section
            ref={target(unexplained.key)}
            aria-label={stopTitle(unexplained)}
            className="flex min-w-0 scroll-mt-4 flex-col gap-5"
          >
            <ClosingHeading
              eyebrow="After the decisions"
              title="Not explained"
              lead={
                unexplained.paths.length > 0
                  ? `${unexplained.paths.length} changed ${unexplained.paths.length === 1 ? 'file has' : 'files have'} no decision pointing at ${unexplained.paths.length === 1 ? 'it' : 'them'}. Read ${unexplained.paths.length === 1 ? 'it' : 'them'} before calling the review done, or ask the agent to explain.`
                  : 'Every changed file belongs to a decision, but some lines inside them have no explanation.'
              }
            />
            {unexplained.partial.length > 0 && (
              <section aria-labelledby="closing-partial">
                <h3
                  id="closing-partial"
                  className="flex justify-between border-b pb-2 text-xs text-muted-foreground"
                >
                  <span>
                    {unexplained.partial.length}{' '}
                    {unexplained.partial.length === 1 ? 'place' : 'places'}{' '}
                    inside explained files
                  </span>
                  <span className="hidden @2xl/review:inline">
                    no step covers these lines
                  </span>
                </h3>
                <ul
                  aria-label="Unexplained lines in explained files"
                  className="flex flex-col divide-y"
                >
                  {unexplained.partial.map((gap) => (
                    <li
                      key={gap.path}
                      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                    >
                      <TriangleAlertIcon className="size-4 shrink-0 text-graph-4" />
                      <span
                        className="min-w-0 flex-1 font-mono text-xs break-all"
                        title={gap.path}
                      >
                        {gap.path}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {gap.ranges.length > 0
                          ? spansLabel(gap.ranges)
                          : 'whole file'}
                      </span>
                      <Button
                        variant="link"
                        size="xs"
                        onClick={() => onGo(gap.stop)}
                      >
                        Read in {placeName(stops, gap.stop)}
                        <ArrowRightIcon data-icon="inline-end" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {unexplained.paths.length > 0 && (
              <section
                aria-labelledby="closing-files"
                className="flex min-w-0 flex-col"
              >
                <h3
                  id="closing-files"
                  className="flex justify-between pb-2 text-xs text-muted-foreground"
                >
                  <span>
                    {unexplained.paths.length}{' '}
                    {unexplained.paths.length === 1 ? 'file' : 'files'} no
                    decision points at
                  </span>
                  <span className="tabular-nums">
                    {filesReviewed(unexplained.paths, items).reviewed} of{' '}
                    {unexplained.paths.length} reviewed
                  </span>
                </h3>
                {code(unexplained)}
              </section>
            )}
          </section>
        )}
        {specs && (
          <section
            ref={target(specs.key)}
            aria-label={stopTitle(specs)}
            className="flex min-w-0 scroll-mt-4 flex-col gap-5"
          >
            <ClosingHeading
              eyebrow="Set apart by your settings"
              title="Specs"
              lead="Specs are folded because agents follow the project's spec rules. Open the ones that matter to you; the countdown still includes them."
            />
            {code(specs)}
          </section>
        )}
      </div>
    </MarginRow>
  );
}

function placeName(stops: readonly WalkthroughStop[], key: WalkthroughKey) {
  const found = stops.find((item) => item.key === key);
  if (!found) return key;
  return found.kind === 'decision'
    ? `decision ${found.number}`
    : stopTitle(found);
}

function ClosingHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead: string;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-3">
      <p className="text-xs text-muted-foreground">{eyebrow}</p>
      <h2 className="text-3xl leading-tight font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-base text-pretty">{lead}</p>
    </header>
  );
}

function CompletionCard({
  stops,
  revision,
  record,
  items,
  threads,
  pullRequest,
  archivable,
  status,
  scope,
  context,
}: {
  stops: readonly WalkthroughStop[];
  revision: ReviewRevision;
  record: DurableReviewRead['review'];
  items: readonly Pick<ReviewChangeItem, 'path' | 'reviewStatus'>[];
  threads: readonly CommentThread[];
  pullRequest: LinkedPullRequest | undefined;
  archivable: boolean;
  status: CompletionStatus;
  scope: WalkthroughProps['scope'];
  context: ConnectionContext;
}) {
  const [asking, setAsking] = useState(false);
  const [askButton, setAskButton] = useState<HTMLButtonElement | null>(null);
  const { group } = status;
  const allDecisions = status.total > 0 && status.reviewed === status.total;
  const merge = revision.verdict.recommendation === 'merge';
  const files = filesReviewed(
    stops.flatMap((stop) => stop.paths),
    items,
  );
  const unexplained = stops.find((stop) => stop.kind === 'unexplained');
  const specs = stops.find((stop) => stop.kind === 'specs');
  const openComments = threads.filter(
    (thread) => threadState(thread) !== 'resolved',
  ).length;
  const notProven = verdictSections(revision).notProven.length;
  return (
    <section
      aria-label="Review completion"
      className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-xs shadow-sm"
    >
      <header className="flex items-start gap-2.5">
        {allDecisions ? (
          <CircleCheckIcon className="mt-0.5 size-5 shrink-0 text-graph-1" />
        ) : (
          <CircleIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-sm font-semibold">
            {allDecisions
              ? 'Every decision is reviewed'
              : `${status.reviewed} of ${status.total} decisions reviewed`}
          </h3>
          <p className="text-muted-foreground tabular-nums">
            {files.reviewed} of {files.total} files reviewed
          </p>
        </div>
      </header>
      <section
        aria-label="Ready to merge needs"
        className="flex flex-col gap-1.5 border-t pt-3"
      >
        <h4 className="text-muted-foreground">Ready to merge needs</h4>
        <Need met={allDecisions}>Every decision reviewed</Need>
        <Need met={merge}>
          The agent recommends Merge
          {!merge && (
            <span className="text-muted-foreground">
              {' '}
              · r{revision.revision} says Hold
            </span>
          )}
        </Need>
        <p
          role="status"
          className={cn(
            'flex items-center gap-1.5',
            group === 'Ready to merge'
              ? 'font-medium text-graph-1'
              : 'text-muted-foreground',
          )}
        >
          {group === 'Waiting on agent' && (
            <LoaderCircleIcon className="size-3.5 shrink-0" />
          )}
          {groupLabel(group)}
        </p>
      </section>
      <section
        aria-label="Still open"
        className="flex flex-col gap-1 border-t pt-3"
      >
        <h4 className="text-muted-foreground">Still open</h4>
        <OpenRow label="Not explained">
          {count(unexplained?.paths.length ?? 0, 'file')}
        </OpenRow>
        <OpenRow label="Specs">
          {count(specs?.paths.length ?? 0, 'file')}
        </OpenRow>
        <OpenRow label="Comments">
          {openComments === 0 ? 'None open' : `${openComments} open`}
        </OpenRow>
        <OpenRow label="Not proven">{notProven}</OpenRow>
      </section>
      <div className="flex flex-col gap-2 border-t pt-3">
        <Button
          ref={setAskButton}
          aria-expanded={asking}
          onClick={() => setAsking(true)}
        >
          <MessageSquareIcon data-icon="inline-start" />
          Ask the agent
        </Button>
        {asking && (
          <InlineComposer
            scope={scope}
            context={context}
            anchor={{
              kind: 'change',
              revision: revision.headOid,
              comparison: { kind: 'branch', base: revision.base },
            }}
            onClose={() => {
              setAsking(false);
              askButton?.focus();
            }}
          />
        )}
        {pullRequest?.state === 'open' && (
          <a
            className={cn(buttonVariants({ variant: 'outline' }))}
            href={pullRequest.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Merge on GitHub #{pullRequest.number}
            <ExternalLinkIcon data-icon="inline-end" />
          </a>
        )}
        {archivable && record ? (
          <ArchiveReview
            connection={context.connection}
            reviewId={record.reviewId}
          />
        ) : (
          pullRequest?.state === 'open' && (
            <p className="flex items-start gap-1.5 text-muted-foreground">
              <ArchiveIcon className="mt-px size-3.5 shrink-0" />
              Archive appears here once #{pullRequest.number} is merged.
            </p>
          )
        )}
      </div>
    </section>
  );
}

function groupLabel(group: CompletionGroup) {
  if (group === 'Ready to merge') return 'Ready to merge';
  if (group === 'Waiting on agent') return 'Waiting on the agent';
  return 'Still needs you';
}

function count(total: number, noun: string) {
  return `${total} ${total === 1 ? noun : `${noun}s`}`;
}

function Need({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5">
      {met ? (
        <CircleCheckIcon
          aria-label="Met"
          className="mt-px size-3.5 shrink-0 text-graph-2"
        />
      ) : (
        <CircleIcon
          aria-label="Not met"
          className="mt-px size-3.5 shrink-0 text-muted-foreground"
        />
      )}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function OpenRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span className="text-muted-foreground tabular-nums">{children}</span>
    </p>
  );
}
