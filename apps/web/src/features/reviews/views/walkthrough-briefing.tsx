import {
  ArrowRightIcon,
  CheckIcon,
  FileQuestionIcon,
  FlaskConicalIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { TruncatedText } from '@/shared/views/truncated-text';
import { relativeTime } from '@/shared/lib/relative-time';
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
import { SectionHeading } from './section-heading';
import {
  changeTags,
  primaryPill,
  quietButton,
  smallButton,
} from './review-controls';
import type { WalkthroughProps } from './walkthrough-props';

export function WalkthroughBriefing({
  review,
  stops,
  items,
  decisions,
  done: isDone,
  onGo,
  revision,
  latestRevision,
  title,
  margin,
  proofCurrent,
  pullRequestChip,
  scope,
  context,
}: WalkthroughProps & {
  revision: ReviewRevision;
  latestRevision: number;
  title: string;
  margin: ReactNode;
  proofCurrent: boolean;
  pullRequestChip?: ReactNode;
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
  const askedNumbers = new Set(
    parts.questions.flatMap((part) =>
      part.decision === undefined ? [] : [part.decision],
    ),
  );
  const asked = decisionStops.find((stop) => askedNumbers.has(stop.number));
  const hasParts =
    parts.added.length + parts.changed.length + parts.removed.length > 0;
  return (
    <div className="shrink-0" aria-label="Briefing" role="region">
      <div className="mx-auto flex w-full max-w-264 flex-col gap-9 px-4 pt-8 pb-16 @2xl/review:px-6 @5xl/review:pr-9 @5xl/review:pl-5.5">
        <MarginRow margin={margin}>
          <div className="flex min-w-0 flex-col gap-10">
            <header className="flex min-w-0 flex-col gap-5">
              <p className="flex flex-wrap gap-x-2 text-ui leading-5.5 font-medium text-muted-foreground">
                <span>Briefing</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Revision {review.revision} of {latestRevision}
                </span>
                <span aria-hidden="true">·</span>
                <span>{relativeTime(revision.publishedAt)}</span>
                {pullRequestChip}
              </p>
              <h2 className="text-briefing-title font-semibold wrap-anywhere">
                <TruncatedText
                  text={title}
                  lines={3}
                  className="min-w-0 text-title-dim"
                />
                <span className="block">
                  {briefingTitle(decisionStops.length)}.
                </span>
              </h2>
              <ReviewVerdict revision={revision} />
              <div className="flex flex-wrap items-center gap-1.5">
                {next ? (
                  <button
                    type="button"
                    className={cn(
                      primaryPill,
                      'min-h-9 max-w-full min-w-0 gap-2 pr-3.5 pl-4 text-left text-sm leading-4 whitespace-normal',
                    )}
                    onClick={() => onGo(next.key)}
                  >
                    <span className="min-w-0 wrap-anywhere">
                      {next.kind === 'decision'
                        ? `Continue at decision ${next.number}`
                        : `Continue at ${stopTitle(next)}`}
                    </span>
                    <ArrowRightIcon className="size-3.5" />
                  </button>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-graph-2">
                    <CheckIcon className="size-4" />
                    Everything in this change is reviewed
                  </p>
                )}
                {asked && (
                  <button
                    type="button"
                    className={cn(
                      quietButton,
                      'h-9 gap-1.75 rounded-full px-3 text-ui leading-4',
                    )}
                    onClick={() => onGo(asked.key)}
                  >
                    <TriangleAlertIcon className="size-3.5 text-warn" />
                    Decision {asked.number} needs you
                  </button>
                )}
                {stale > 0 && (
                  <span className="px-3 text-ui leading-4 text-warn">
                    {stale} decisions have code moved
                  </span>
                )}
                {unexplained && (
                  <span className="px-3 text-ui leading-4 text-muted-foreground">
                    Changes remain not explained
                  </span>
                )}
              </div>
            </header>
            {parts.questions.length > 0 && (
              <section
                aria-label="Needs your decision"
                className="flex flex-col gap-3.5"
              >
                <SectionHeading
                  id="briefing-questions"
                  aside={parts.questions.length}
                >
                  Needs your decision
                </SectionHeading>
                {parts.questions.map((part) => (
                  <AnswerableQuestion
                    key={part.id}
                    part={part}
                    revision={revision}
                    scope={scope}
                    context={context}
                    decisionTitle={
                      part.decision === undefined
                        ? undefined
                        : review.layers[part.decision - 1]?.title
                    }
                    action={
                      <DecisionLink
                        part={part}
                        review={review}
                        onGo={onGo}
                        label={`Open decision ${part.decision}`}
                      />
                    }
                  />
                ))}
              </section>
            )}
          </div>
        </MarginRow>
        <MarginRow margin={<BriefingRemoved revision={revision} />}>
          <section aria-labelledby="briefing-system" className="flex flex-col">
            <SectionHeading
              id="briefing-system"
              aside={
                hasParts
                  ? [
                      `${parts.added.length} new`,
                      `${parts.changed.length} changed`,
                      `${parts.removed.length} removed`,
                    ].join(' · ')
                  : undefined
              }
            >
              What this adds to the system
            </SectionHeading>
            {hasParts ? (
              <div className="flex flex-col divide-y">
                <PartGroup
                  title="New"
                  parts={parts.added}
                  review={review}
                  onGo={onGo}
                />
                <PartGroup
                  title="Changed"
                  parts={parts.changed}
                  review={review}
                  onGo={onGo}
                />
                <PartGroup
                  title="Removed"
                  parts={parts.removed}
                  review={review}
                  onGo={onGo}
                  struck
                />
              </div>
            ) : (
              <p className="pt-3 text-sm text-muted-foreground">
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
            <p className="text-ui leading-5 text-muted-foreground">
              Every changed file belongs to exactly one stop, and changes no
              decision explains come last, so finishing the walkthrough means
              nothing was left out.
            </p>
          }
        >
          <section
            aria-labelledby="briefing-decisions"
            className="flex min-w-0 flex-col"
          >
            <SectionHeading
              id="briefing-decisions"
              aside={`${done} of ${decisionStops.length} decisions · ${total.reviewed} of ${total.total} files reviewed`}
            >
              The walkthrough
            </SectionHeading>
            <ol className="flex flex-col divide-y">
              {decisionStops.map((stop) => {
                const state = decisions.get(stop.layer.id);
                const progress = filesReviewed(stop.paths, items);
                const route =
                  decisionRoute(stop.layer).join(' → ') || 'No changed code';
                const needsYou = askedNumbers.has(stop.number);
                return (
                  <WalkthroughRow
                    key={stop.key}
                    stop={stop}
                    onGo={onGo}
                    detail={route}
                    current={stop.key === next?.key}
                  >
                    {(clip) => (
                      <>
                        <StopMark
                          done={isDone(stop)}
                          current={stop.key === next?.key}
                          label={`${stop.number}`}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5 @2xl/review:flex-row @2xl/review:items-baseline @2xl/review:gap-3">
                          <span className="min-w-0 text-sm leading-4.5 font-medium wrap-anywhere @2xl/review:flex-1">
                            {stop.layer.title}
                            {(needsYou || state?.stale) && (
                              <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-warn">
                                {needsYou && (
                                  <TriangleAlertIcon className="size-3" />
                                )}
                                {[
                                  needsYou && 'needs you',
                                  state?.stale && 'code moved',
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            )}
                          </span>
                          {clip(
                            route,
                            'text-xs text-muted-foreground @2xl/review:max-w-1/2',
                          )}
                        </span>
                        <span className="w-9 shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums">
                          {progress.reviewed}/{progress.total}
                        </span>
                      </>
                    )}
                  </WalkthroughRow>
                );
              })}
              {after.map((stop) => {
                const progress = filesReviewed(stop.paths, items);
                return (
                  <WalkthroughRow
                    key={stop.key}
                    stop={stop}
                    onGo={onGo}
                    current={stop.key === next?.key}
                  >
                    {() => (
                      <>
                        <span
                          className={cn(
                            'grid size-5 shrink-0 place-items-center rounded-full border text-muted-foreground',
                            stop.kind === 'unexplained' &&
                              'border-warn-border bg-warn-soft text-warn',
                          )}
                        >
                          {stop.kind === 'unexplained' ? (
                            <FileQuestionIcon className="size-3" />
                          ) : (
                            <FlaskConicalIcon className="size-3" />
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5 @2xl/review:flex-row @2xl/review:items-baseline @2xl/review:gap-3">
                          <span className="min-w-0 text-sm leading-4.5 font-medium wrap-anywhere @2xl/review:flex-1">
                            {stopName(stop)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {stop.kind === 'unexplained'
                              ? 'Changes no decision explains'
                              : 'Set apart by your settings'}
                          </span>
                        </span>
                        <span className="w-9 shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums">
                          {progress.reviewed}/{progress.total}
                        </span>
                      </>
                    )}
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

function WalkthroughRow({
  stop,
  onGo,
  children,
  detail,
  current,
}: {
  stop: WalkthroughStop;
  onGo: (key: WalkthroughKey) => void;
  children: (
    clip: (value: string, className?: string) => ReactNode,
  ) => ReactNode;
  detail?: string;
  current: boolean;
}) {
  const name =
    detail === undefined ? stopTitle(stop) : `${stopTitle(stop)} · ${detail}`;
  return (
    <li>
      <TruncatedText
        text={detail ?? stopTitle(stop)}
        renderTrigger={(_label, clip) => (
          <button
            type="button"
            aria-label={name}
            aria-current={current ? 'step' : undefined}
            onClick={() => onGo(stop.key)}
            className={cn(
              'flex min-h-8.5 w-full items-center gap-3 rounded-md px-1.5 py-2 text-left hover:bg-accent',
              current && 'bg-brand-soft hover:bg-brand-soft',
            )}
          >
            {children(clip)}
          </button>
        )}
      />
    </li>
  );
}

function StopMark({
  done,
  current,
  label,
}: {
  done: boolean;
  current: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-full border border-border-strong text-2xs leading-none font-medium text-muted-foreground tabular-nums',
        current && 'border-brand bg-background font-semibold text-brand',
        done && 'border-brand bg-brand text-brand-foreground',
      )}
    >
      {done ? <CheckIcon className="size-3" aria-label="Reviewed" /> : label}
    </span>
  );
}

const partTags = {
  New: changeTags.new,
  Changed: changeTags.changed,
  Removed: changeTags.removed,
} as const;

function PartGroup({
  title,
  parts,
  review,
  onGo,
  struck = false,
}: {
  title: keyof typeof partTags;
  parts: readonly SystemPart[];
  review: WalkthroughProps['review'];
  onGo: (key: WalkthroughKey) => void;
  struck?: boolean;
}) {
  if (parts.length === 0) return null;
  return (
    <ul aria-label={title} className="flex min-w-0 flex-col">
      {parts.map((part, index) => (
        <li
          key={part.id}
          className="flex min-h-8.5 min-w-0 flex-col items-stretch gap-1 py-2 @2xl/review:flex-row @2xl/review:items-center @2xl/review:gap-3"
        >
          <span className="shrink-0 @2xl/review:w-21">
            {index === 0 && <span className={partTags[title]}>{title}</span>}
          </span>
          <TruncatedText
            className="min-w-0 flex-1 leading-4.5"
            text={part.detail ? `${part.label} · ${part.detail}` : part.label}
          >
            <span
              className={cn(
                'text-sm leading-4.5 font-medium',
                struck && 'text-muted-foreground line-through',
              )}
            >
              {part.label}
            </span>
            {part.detail && (
              <span className="text-ui text-muted-foreground">
                {' '}
                · {part.detail}
              </span>
            )}
          </TruncatedText>
          <DecisionLink part={part} review={review} onGo={onGo} inline />
        </li>
      ))}
    </ul>
  );
}

function DecisionLink({
  part,
  review,
  onGo,
  inline = false,
  label,
}: {
  part: SystemPart;
  review: WalkthroughProps['review'];
  onGo: (key: WalkthroughKey) => void;
  inline?: boolean;
  label?: string;
}) {
  const layer =
    part.decision === undefined ? undefined : review.layers[part.decision - 1];
  if (!layer || part.decision === undefined) return null;
  return (
    <button
      type="button"
      className={cn(
        inline
          ? `${quietButton} h-6.5 gap-1.25 self-start pr-1.5 pl-2 text-xs leading-4 text-muted-foreground hover:text-foreground @2xl/review:self-center`
          : `${smallButton} border border-border bg-background pr-2.5 pl-3 hover:bg-muted`,
      )}
      onClick={() => onGo(decisionKey(layer.id))}
    >
      {label ?? `Decision ${part.decision}`}
      <ArrowRightIcon className="size-3" />
    </button>
  );
}
