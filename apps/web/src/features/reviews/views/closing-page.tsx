import { Button, buttonVariants } from '@/components/ui/button';
import {
  ArchiveIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleIcon,
  ExternalLinkIcon,
  MessageSquareIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { spansLabel } from '@porcelain/client/changes/rules';
import {
  counted,
  plural,
  changeAnchor,
  filesReviewed,
  type reviewListStatus,
  stopTitle,
  threadCounts,
  verdictSections,
  proofStatus,
  type CommentThread,
  type DurableReviewRead,
  type ReviewChangeItem,
  type ReviewRevision,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
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
  'reviewed' | 'total'
> & { group: ReturnType<typeof reviewListStatus>['group'] | 'Closed' };
type LinkedPullRequest = { number: number; url: string; state: string };

type CompletionProps = {
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
};

export function ClosingPage({
  current,
  onGo,
  code,
  ...completion
}: CompletionProps & {
  current: ClosingStop;
  onGo: (key: WalkthroughKey) => void;
  code: (stop: ClosingStop) => ReactNode;
}) {
  const { stops, items } = completion;
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
    const moved = scrolled !== undefined;
    setScrolled(key);
    if (moved || (key === 'specs' && unexplained))
      node.scrollIntoView({ block: 'start' });
  };
  return (
    <MarginRow
      margin={
        <aside
          aria-label="Completion"
          className="min-w-0 @5xl/review:sticky @5xl/review:top-4 @5xl/review:self-start"
        >
          <CompletionCard {...completion} />
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
                  ? `${unexplained.paths.length} changed ${plural(unexplained.paths.length, 'file has', 'files have')} no decision pointing at ${plural(unexplained.paths.length, 'it', 'them')}. Read ${plural(unexplained.paths.length, 'it', 'them')} before calling the review done, or ask the agent to explain.`
                  : 'Every changed file belongs to a decision, but some lines inside them have no explanation.'
              }
            />
            {unexplained.partial.length > 0 && (
              <section aria-labelledby="closing-partial">
                <h3
                  id="closing-partial"
                  className="flex justify-between gap-3.5 border-b pb-1.5 text-xs leading-4 text-muted-foreground"
                >
                  <span className="font-medium tabular-nums">
                    {counted(unexplained.partial.length, 'place')} inside
                    explained files
                  </span>
                  <span className="hidden @2xl/review:inline">
                    no step covers these lines
                  </span>
                </h3>
                <ul
                  aria-label="Unexplained lines in explained files"
                  className="flex flex-col"
                >
                  {unexplained.partial.map((gap) => (
                    <li
                      key={gap.path}
                      className="flex min-h-7.5 min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 py-1 pr-1.5 pl-0.5"
                    >
                      <TriangleAlertIcon className="size-3.5 shrink-0 text-warn" />
                      <span
                        className="min-w-0 flex-1 font-mono text-caption leading-4 break-all"
                        title={gap.path}
                      >
                        {gap.path}
                      </span>
                      <span className="text-xs leading-4 text-muted-foreground tabular-nums">
                        {gap.ranges.length > 0
                          ? spansLabel(gap.ranges)
                          : 'whole file'}
                      </span>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => onGo(gap.stop)}
                      >
                        Read in {placeName(stops, gap.stop)}
                        <ChevronRightIcon />
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
                  className="flex justify-between pb-1 text-xs leading-4 text-muted-foreground"
                >
                  <span className="font-medium">
                    {counted(unexplained.paths.length, 'file')} no decision
                    points at
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
              size="subpage"
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
  size = 'page',
}: {
  eyebrow: string;
  title: string;
  lead: string;
  size?: 'page' | 'subpage';
}) {
  return (
    <header
      className={cn(
        'flex min-w-0 flex-col',
        size === 'page' ? 'gap-2.5' : 'gap-1.5',
      )}
    >
      <p className="text-ui leading-5.5 font-medium text-muted-foreground">
        {eyebrow}
      </p>
      <h2
        className={cn(
          'font-semibold text-balance',
          size === 'page' ? 'text-page-title' : 'text-subpage-title',
        )}
      >
        {title}
      </h2>
      <p
        className={`text-pretty text-foreground-2 ${size === 'page' ? 'text-lead' : 'text-reading'}`}
      >
        {lead}
      </p>
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
}: CompletionProps) {
  const [asking, setAsking] = useState(false);
  const [askButton, setAskButton] = useState<HTMLButtonElement | null>(null);
  const allDecisions = status.total > 0 && status.reviewed === status.total;
  const files = filesReviewed(
    stops.flatMap((stop) => stop.paths),
    items,
  );
  const unexplained = stops.find((stop) => stop.kind === 'unexplained');
  const specs = stops.find((stop) => stop.kind === 'specs');
  const openComments = threadCounts(threads).open;
  const notProven = verdictSections(revision).notProven.length;
  const checks = proofStatus(revision.content.proof);
  return (
    <section
      aria-label="Review completion"
      className="flex min-w-0 flex-col gap-3 rounded-paper border bg-card px-3 pt-3.5 pb-3 text-xs shadow-sm"
    >
      <header className="flex items-start gap-2">
        {allDecisions ? (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground">
            <CheckIcon className="size-2.75" strokeWidth={3} />
          </span>
        ) : (
          <CircleIcon className="size-5 shrink-0 text-muted-foreground" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-card-title font-semibold">Decisions reviewed</h3>
          <p className="text-muted-foreground tabular-nums">
            {status.reviewed} of {counted(status.total, 'decision')}
          </p>
          <p className="text-muted-foreground tabular-nums">
            {files.reviewed} of {counted(files.total, 'file')} reviewed
          </p>
        </div>
      </header>
      <section
        aria-label="Agent recommendation"
        className="flex flex-col gap-1.25 border-t pt-3"
      >
        <h4 className="font-medium text-muted-foreground">
          Agent recommendation
        </h4>
        <p className="font-medium">
          {revision.verdict.recommendation === 'merge' ? 'Merge' : 'Hold'} · r
          {revision.revision}
        </p>
      </section>
      <section
        aria-label="Published proof"
        className="flex flex-col gap-0.5 border-t pt-3"
      >
        <h4 className="mb-1 font-medium text-muted-foreground">
          Published proof
        </h4>
        <OpenRow label="Checks">
          {checks.passing + checks.failing === 0
            ? 'None published'
            : `${checks.passing} passed · ${checks.failing} failed`}
        </OpenRow>
        <OpenRow label="Not proven">{notProven}</OpenRow>
      </section>
      <section
        aria-label="Still open"
        className="flex flex-col gap-0.5 border-t pt-3"
      >
        <h4 className="mb-1 font-medium text-muted-foreground">Still open</h4>
        <OpenRow label="Not explained">
          {counted(unexplained?.paths.length ?? 0, 'file')}
        </OpenRow>
        <OpenRow label="Specs">
          {counted(specs?.paths.length ?? 0, 'file')}
        </OpenRow>
        <OpenRow label="Comments">
          {openComments === 0 ? 'None open' : `${openComments} open`}
        </OpenRow>
        <OpenRow label="Files left">{files.total - files.reviewed}</OpenRow>
      </section>
      <div className="flex flex-col gap-1.5 border-t pt-3">
        <Button
          ref={setAskButton}
          type="button"
          variant="default"
          aria-expanded={asking}
          onClick={() => setAsking(true)}
        >
          <MessageSquareIcon />
          Ask the agent
        </Button>
        {asking && (
          <InlineComposer
            scope={scope}
            context={context}
            anchor={changeAnchor({
              base: revision.base,
              tip: revision.headOid,
            })}
            onClose={() => {
              setAsking(false);
              askButton?.focus();
            }}
          />
        )}
        {pullRequest?.state === 'open' && (
          <a
            href={pullRequest.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            Merge on GitHub
            <span className="text-muted-foreground tabular-nums">
              #{pullRequest.number}
            </span>
            <ExternalLinkIcon />
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

function OpenRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-ui leading-4.5">
      <span>{label}</span>
      <span className="text-muted-foreground tabular-nums">{children}</span>
    </p>
  );
}
