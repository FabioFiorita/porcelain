import {
  ArrowRightIcon,
  CheckIcon,
  FileQuestionIcon,
  FlaskConicalIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FullValueTooltip } from '@/shared/views/full-value-tooltip';
import { cn } from '@/shared/lib/utils';
import {
  briefingTitle,
  decisionKey,
  type DecisionState,
  decisionRoute,
  filesReviewed,
  type ReviewRevision,
  type ReviewChangeItem,
  type SystemPart,
  stopName,
  stopTitle,
  systemChanges,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { ReviewVerdict } from './review-verdict';
import { BriefingRemoved, BriefingNotProven } from './briefing-margin';
import { ReviewProof } from './review-proof';
import { AnswerableQuestion } from './walkthrough-question';
import { MarginRow } from './margin-row';
import type { WalkthroughProps } from './walkthrough-props';

export function WalkthroughBriefing({
  review,
  stops,
  items,
  decisions,
  done: isDone,
  onGo,
  revision,
  title,
  margin,
  proofCurrent,
  scope,
  context,
}: WalkthroughProps & {
  revision: ReviewRevision;
  title: string;
  margin: ReactNode;
  proofCurrent: boolean;
  stops: readonly WalkthroughStop[];
  items: readonly Pick<ReviewChangeItem, 'path' | 'reviewStatus'>[];
  decisions: ReadonlyMap<string, DecisionState>;
  done: (stop: WalkthroughStop) => boolean;
  onGo: (key: WalkthroughKey) => void;
}) {
  const decisionStops = stops.filter((stop) => stop.kind === 'decision');
  const after = stops.filter(
    (stop) => stop.kind === 'unexplained' || stop.kind === 'specs',
  );
  const total = filesReviewed(
    stops.flatMap((stop) => stop.paths),
    items,
  );
  const done = decisionStops.filter(isDone).length;
  const next = [...decisionStops, ...after].find((stop) => !isDone(stop));
  const parts = systemChanges(review);
  const stale = decisionStops.filter(
    (stop) => decisions.get(stop.layer.id)?.stale,
  ).length;
  const unexplained = stops.find((stop) => stop.kind === 'unexplained');
  const hasParts =
    parts.added.length + parts.changed.length + parts.removed.length > 0;
  return (
    <div className="shrink-0" aria-label="Briefing" role="region">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-8 pb-16 @2xl/review:px-6">
        <MarginRow margin={margin}>
          <div className="flex min-w-0 flex-col gap-8">
            <header className="flex min-w-0 flex-col gap-5">
              <p className="text-xs text-muted-foreground">
                Briefing · Revision {review.revision}
              </p>
              <h2 className="text-3xl leading-tight font-semibold tracking-tight wrap-anywhere">
                <FullValueTooltip value={title} className="block min-w-0">
                  <span className="line-clamp-3 text-muted-foreground">
                    {title}
                  </span>
                </FullValueTooltip>
                <span className="block">
                  {briefingTitle(decisionStops.length)}.
                </span>
              </h2>
              <ReviewVerdict revision={revision} />
              <div className="flex flex-wrap items-center gap-3">
                {next ? (
                  <Button
                    className="h-auto min-h-8 max-w-full min-w-0 text-left whitespace-normal"
                    onClick={() => onGo(next.key)}
                  >
                    <span className="min-w-0 wrap-anywhere">
                      {next.kind === 'decision'
                        ? `Continue at decision ${next.number}`
                        : `Continue at ${stopTitle(next)}`}
                    </span>
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-graph-2">
                    <CheckIcon className="size-4" />
                    Everything in this change is reviewed
                  </p>
                )}
                {stale > 0 && (
                  <span className="text-xs text-graph-4">
                    {stale} decisions have code moved
                  </span>
                )}
                {unexplained && (
                  <span className="text-xs text-muted-foreground">
                    Changes remain not explained
                  </span>
                )}
              </div>
            </header>
            {parts.questions.length > 0 && (
              <section
                aria-label="Needs your decision"
                className="flex flex-col gap-3"
              >
                <SectionTitle id="briefing-questions">
                  Needs your decision
                </SectionTitle>
                {parts.questions.map((part) => (
                  <AnswerableQuestion
                    key={part.id}
                    part={part}
                    revision={revision}
                    scope={scope}
                    context={context}
                    action={
                      <DecisionLink part={part} review={review} onGo={onGo} />
                    }
                  />
                ))}
              </section>
            )}
          </div>
        </MarginRow>
        <MarginRow margin={<BriefingRemoved revision={revision} />}>
          <section
            aria-labelledby="briefing-system"
            className="flex flex-col gap-3"
          >
            <SectionTitle id="briefing-system">
              What this adds to the system
            </SectionTitle>
            {hasParts ? (
              <div className="flex flex-col divide-y border-y">
                <PartGroup
                  title="New"
                  icon={<PlusIcon className="size-3.5 text-graph-2" />}
                  parts={parts.added}
                  review={review}
                  onGo={onGo}
                />
                <PartGroup
                  title="Changed"
                  icon={<PencilIcon className="size-3.5 text-graph-1" />}
                  parts={parts.changed}
                  review={review}
                  onGo={onGo}
                />
                <PartGroup
                  title="Removed"
                  icon={<MinusIcon className="size-3.5 text-destructive" />}
                  parts={parts.removed}
                  review={review}
                  onGo={onGo}
                  struck
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No system owners listed.
              </p>
            )}
          </section>
        </MarginRow>
        <MarginRow margin={<BriefingNotProven revision={revision} />}>
          <ReviewProof
            columns
            revision={revision}
            scope={scope}
            context={context}
            current={proofCurrent}
            title={`Proven at ${revision.headOid.slice(0, 7)}`}
          />
        </MarginRow>
        <MarginRow
          margin={
            <p className="text-xs text-muted-foreground">
              Every changed file belongs to exactly one stop, and changes no
              decision explains come last, so finishing the walkthrough means
              nothing was left out.
            </p>
          }
        >
          <section
            aria-labelledby="briefing-decisions"
            className="flex min-w-0 flex-col gap-2"
          >
            <SectionTitle id="briefing-decisions">The walkthrough</SectionTitle>
            <p className="text-xs text-muted-foreground">
              {done} of {decisionStops.length} decisions · {total.reviewed} of{' '}
              {total.total} files reviewed
            </p>
            <ol className="flex flex-col divide-y border-y">
              {decisionStops.map((stop) => {
                const state = decisions.get(stop.layer.id);
                const progress = filesReviewed(stop.paths, items);
                return (
                  <WalkthroughRow key={stop.key} stop={stop} onGo={onGo}>
                    <StopMark done={isDone(stop)} label={`${stop.number}`} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 @2xl/review:flex-row @2xl/review:items-baseline @2xl/review:gap-3">
                      <span className="min-w-0 text-sm font-medium wrap-anywhere @2xl/review:flex-1">
                        {stop.layer.title}
                      </span>
                      <span className="min-w-0 truncate text-xs text-muted-foreground @2xl/review:max-w-1/2">
                        {decisionRoute(stop.layer).join(' → ') ||
                          'No changed code'}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {progress.reviewed}/{progress.total} files
                      </span>
                      {state?.stale && (
                        <Badge variant="outline">
                          <TriangleAlertIcon className="text-graph-4" /> Code
                          moved
                        </Badge>
                      )}
                    </span>
                  </WalkthroughRow>
                );
              })}
              {after.map((stop) => {
                const progress = filesReviewed(stop.paths, items);
                return (
                  <WalkthroughRow key={stop.key} stop={stop} onGo={onGo}>
                    <span
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground',
                        stop.kind === 'unexplained' &&
                          'bg-graph-4/15 text-graph-4',
                      )}
                    >
                      {stop.kind === 'unexplained' ? (
                        <FileQuestionIcon className="size-3.5" />
                      ) : (
                        <FlaskConicalIcon className="size-3.5" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 @2xl/review:flex-row @2xl/review:items-baseline @2xl/review:gap-3">
                      <span className="min-w-0 text-sm font-medium wrap-anywhere @2xl/review:flex-1">
                        {stopName(stop)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {stop.kind === 'unexplained'
                          ? 'Changes no decision explains'
                          : 'Set apart by your settings'}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {progress.reviewed}/{progress.total} files
                    </span>
                  </WalkthroughRow>
                );
              })}
            </ol>
          </section>
        </MarginRow>
      </div>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-sm font-semibold">
      {children}
    </h3>
  );
}

function WalkthroughRow({
  stop,
  onGo,
  children,
}: {
  stop: WalkthroughStop;
  onGo: (key: WalkthroughKey) => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        aria-label={stopTitle(stop)}
        onClick={() => onGo(stop.key)}
        className="flex w-full items-start gap-3 px-3.5 py-2 text-left hover:bg-accent/50"
      >
        {children}
      </button>
    </li>
  );
}

function StopMark({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border text-2xs font-semibold tabular-nums',
        done && 'border-graph-2 bg-graph-2 text-background',
      )}
    >
      {done ? <CheckIcon className="size-3.5" aria-label="Reviewed" /> : label}
    </span>
  );
}

function PartGroup({
  title,
  icon,
  parts,
  review,
  onGo,
  struck = false,
}: {
  title: string;
  icon: ReactNode;
  parts: readonly SystemPart[];
  review: WalkthroughProps['review'];
  onGo: (key: WalkthroughKey) => void;
  struck?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 py-3 @2xl/review:flex-row">
      <p className="flex shrink-0 items-start @2xl/review:w-20 gap-1 text-xs font-medium">
        {icon}
        {title}
        <span className="text-muted-foreground tabular-nums">
          {parts.length}
        </span>
      </p>
      {parts.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing</p>
      ) : (
        <ul className="flex min-w-0 flex-1 flex-col gap-2">
          {parts.map((part) => (
            <li
              key={part.id}
              className="flex min-w-0 flex-col items-start gap-2 @2xl/review:flex-row @2xl/review:items-baseline"
            >
              <p className="min-w-0 flex-1 text-sm wrap-anywhere">
                <strong
                  className={cn(
                    'font-medium',
                    struck && 'text-muted-foreground line-through',
                  )}
                >
                  {part.label}
                </strong>
                {part.detail && (
                  <span className="text-xs text-muted-foreground">
                    {' '}
                    · {part.detail}
                  </span>
                )}
              </p>
              <DecisionLink part={part} review={review} onGo={onGo} inline />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DecisionLink({
  part,
  review,
  onGo,
  inline = false,
}: {
  part: SystemPart;
  review: WalkthroughProps['review'];
  onGo: (key: WalkthroughKey) => void;
  inline?: boolean;
}) {
  const layer =
    part.decision === undefined ? undefined : review.layers[part.decision - 1];
  if (!layer || part.decision === undefined) return null;
  return (
    <Button
      variant="link"
      size="xs"
      className={cn('shrink-0', inline && 'self-start')}
      onClick={() => onGo(decisionKey(layer.id))}
    >
      Decision {part.decision}
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  );
}
