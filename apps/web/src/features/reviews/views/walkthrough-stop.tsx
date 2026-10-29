import { TruncatedText } from '@/shared/views/truncated-text';
import {
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  CircleXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarkdownView } from '@/features/files/index';
import { cn } from '@/shared/lib/utils';
import { LONG_DECISION_SUMMARY } from '@/config/limits';
import {
  basename,
  checkResultLabel,
  decisionKey,
  decisionLinks,
  decisionQuestions,
  decisionRoute,
  filesReviewed,
  orderedChecks,
  proofOnLayer,
  type DecisionLink,
  type DecisionState,
  type ReviewChangeItem,
  type ReviewLayer,
  type ReviewRevision,
  type ReviewStep,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { MarginQuestion } from './walkthrough-question';
import { MarginRow } from './margin-row';
import { changeTags, chip } from './review-controls';
import type { WalkthroughProps } from './walkthrough-props';

type DecisionStop = Extract<WalkthroughStop, { kind: 'decision' }>;

export function DecisionPage({
  stop,
  total,
  review,
  revision,
  scope,
  context,
  decision,
  finished,
  items,
  proofCurrent,
  onStep,
  onGo,
}: {
  proofCurrent: boolean;
  stop: DecisionStop;
  total: number;
  review: WalkthroughProps['review'];
  revision: ReviewRevision;
  scope: WalkthroughProps['scope'];
  context: WalkthroughProps['context'];
  decision: DecisionState | undefined;
  finished: boolean;
  items: readonly Pick<ReviewChangeItem, 'path' | 'reviewStatus'>[];
  onStep: (step: ReviewStep) => void;
  onGo: (key: WalkthroughKey) => void;
}) {
  const { layer } = stop;
  const links = decisionLinks(review, layer.id);
  const questions = decisionQuestions(review, stop);
  const proof = proofOnLayer(review.proof, layer.id);
  const progress = filesReviewed(stop.paths, items);
  return (
    <MarginRow
      margin={
        <aside
          aria-label="Decision details"
          className="flex min-w-0 flex-col gap-6 text-xs"
        >
          {questions.map((part) => (
            <MarginQuestion
              key={part.id}
              part={part}
              revision={revision}
              scope={scope}
              context={context}
            />
          ))}
          {links.length > 0 && <Contracts links={links} />}
          {proof.checks.length > 0 && (
            <section aria-label="Proof" className="flex flex-col gap-2">
              <h3 className="flex items-baseline justify-between border-b pb-2 font-medium text-muted-foreground">
                Proof
                <span className="font-mono font-normal">
                  at {revision.headOid.slice(0, 7)}
                </span>
              </h3>
              {!proofCurrent && (
                <p className="text-graph-4">
                  These checks ran before the latest changes
                </p>
              )}
              <ul
                aria-label="Checks for this decision"
                className="flex flex-col gap-1.5"
              >
                {orderedChecks(proof.checks).map((check) => (
                  <li
                    key={check.name}
                    className={cn(
                      'flex items-start gap-1.5 wrap-anywhere',
                      check.result === 'fail' && 'text-destructive',
                    )}
                  >
                    {check.result === 'fail' ? (
                      <CircleXIcon className="mt-px size-3.5 shrink-0" />
                    ) : (
                      <CircleCheckIcon className="mt-px size-3.5 shrink-0 text-graph-2" />
                    )}
                    <span className="min-w-0">
                      {check.name} · {checkResultLabel(check.result)}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant="link"
                size="xs"
                className="self-start"
                onClick={() => onGo('briefing')}
              >
                All proof for this review
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </section>
          )}
        </aside>
      }
    >
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex min-w-0 flex-col gap-3.5">
          <div className="flex min-h-5.5 flex-wrap items-center gap-2.5">
            <span className="text-ui leading-5.5 font-medium text-muted-foreground tabular-nums">
              Decision {stop.number} of {total}
            </span>
            {questions.length > 0 && (
              <span
                className={cn(
                  chip,
                  'border-transparent bg-brand-soft leading-5.5 text-brand',
                )}
              >
                <CircleHelpIcon /> Needs your decision
              </span>
            )}
            {decision?.stale && (
              <Badge
                variant="warn"
                title="Lines this decision points at changed after the agent explained them. Read the diff below, or ask the agent to publish a revision."
              >
                <TriangleAlertIcon /> Code moved since it was explained
              </Badge>
            )}
            {finished && (
              <span
                className={cn(chip, 'border-border-strong text-foreground')}
              >
                <CheckIcon className="text-brand" /> Reviewed
              </span>
            )}
          </div>
          <h2 className="text-page-title font-semibold wrap-anywhere">
            <span aria-hidden="true" className="text-title-dim">
              {stop.number}.{' '}
            </span>
            {layer.title}
          </h2>
          <Summary text={layer.summary} />
        </header>
        <RouteTable
          layer={layer}
          reviewed={progress.reviewed}
          total={progress.total}
          onStep={onStep}
        />
        {stop.elsewhere.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>Also changes</span>
            {stop.elsewhere.map((file) => (
              <Button
                key={file.path}
                variant="outline"
                size="xs"
                className="max-w-full"
                onClick={() => onGo(file.stop)}
              >
                <TruncatedText text={basename(file.path)} />
                <span className="text-muted-foreground">
                  {file.stop === 'specs'
                    ? '· in Specs'
                    : `· shown in decision ${review.layers.findIndex((item) => decisionKey(item.id) === file.stop) + 1}`}
                </span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </MarginRow>
  );
}

function changeLabel(change: NonNullable<DecisionLink['change']>) {
  if (change === 'new') return 'New';
  if (change === 'changed') return 'Changed';
  return 'Removed';
}

function Contracts({ links }: { links: readonly DecisionLink[] }) {
  return (
    <section aria-label="Contracts" className="flex min-w-0 flex-col gap-2">
      <h3 className="leading-4 font-medium text-muted-foreground">Contracts</h3>
      <ul
        aria-label="Connections"
        className="flex flex-wrap gap-1.5 @5xl/review:flex-col @5xl/review:gap-0 @5xl/review:divide-y @5xl/review:border-y"
      >
        {links.map((link) => (
          <li
            key={link.part.id}
            className="flex min-w-0 items-center gap-1.5 rounded-md border bg-background px-2 py-1 @5xl/review:items-start @5xl/review:justify-between @5xl/review:rounded-none @5xl/review:border-0 @5xl/review:bg-transparent @5xl/review:px-0 @5xl/review:py-2"
          >
            <span className="flex min-w-0 items-baseline gap-1.5 wrap-anywhere @5xl/review:flex-col @5xl/review:gap-0.5">
              <span className="leading-4.5 text-muted-foreground">
                {link.outgoing ? link.verb : `${link.part.label} ${link.verb}`}
              </span>
              {link.outgoing && (
                <span className="text-ui leading-4.5 font-medium text-foreground">
                  {link.part.label}
                </span>
              )}
            </span>
            {link.change && (
              <span className={changeTags[link.change]}>
                {changeLabel(link.change)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > LONG_DECISION_SUMMARY;
  return (
    <div className="flex flex-col items-start gap-1 text-foreground-2">
      <MarkdownView
        text={text}
        className={`text-lead text-pretty [&_p]:leading-7 ${long && !open ? 'line-clamp-3' : ''}`}
      />
      {long && (
        <Button
          variant="link"
          size="xs"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Show less' : 'Read more'}
        </Button>
      )}
    </div>
  );
}

function RouteTable({
  layer,
  reviewed,
  total,
  onStep,
}: {
  layer: ReviewLayer;
  reviewed: number;
  total: number;
  onStep: (step: ReviewStep) => void;
}) {
  if (layer.steps.length === 0) return null;
  const route = decisionRoute(layer);
  return (
    <section aria-label="Route through the system" className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b pb-1.5 text-xs text-muted-foreground">
        <span className="font-medium tabular-nums">
          {layer.steps.length} {layer.steps.length === 1 ? 'stop' : 'stops'}
        </span>
        {route.length > 0 && (
          <ol className="order-last flex min-w-0 basis-full flex-wrap items-center gap-1.5 text-ui leading-4 font-medium text-foreground @2xl/review:order-none @2xl/review:flex-1 @2xl/review:basis-auto">
            {route.map((lane, index) => (
              <li
                key={`${lane}:${index}`}
                className="flex min-w-0 items-center gap-1.5"
              >
                {index > 0 && (
                  <ArrowRightIcon
                    className="size-3 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0">{lane}</span>
              </li>
            ))}
          </ol>
        )}
        <span className="ml-auto tabular-nums">
          {reviewed} of {total} files reviewed here
        </span>
      </div>
      <ol aria-label="Steps" className="flex flex-col">
        {layer.steps.map((step, index) => {
          const lane =
            index === 0 || layer.steps[index - 1]?.lane !== step.lane
              ? layer.lanes[step.lane]
              : undefined;
          return (
            <li
              key={step.id}
              className={lane !== undefined && index > 0 ? 'border-t' : ''}
            >
              <RouteRow
                step={step}
                index={index}
                lane={lane}
                current={index === 0}
                onStep={onStep}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RouteRow({
  step,
  index,
  lane,
  current,
  onStep,
}: {
  step: ReviewStep;
  index: number;
  lane: string | undefined;
  current: boolean;
  onStep: (step: ReviewStep) => void;
}) {
  const value = [lane, step.pointer.path].filter(Boolean).join(' · ');
  return (
    <TruncatedText
      text={value}
      renderTrigger={(_label, clip) => (
        <button
          type="button"
          aria-label={`Go to step ${index + 1}: ${step.title} · ${value}`}
          aria-current={current ? 'step' : undefined}
          onClick={() => onStep(step)}
          className={cn(
            'flex min-h-8 w-full min-w-0 items-start gap-3 rounded-md py-1.5 pr-1.5 text-left hover:bg-accent @2xl/review:items-center',
          )}
        >
          {clip(
            lane ?? '',
            'hidden w-22 shrink-0 text-xs text-muted-foreground @2xl/review:block',
          )}
          <span
            className={cn(
              'grid size-5 shrink-0 place-items-center rounded-full text-2xs leading-none tabular-nums',
              current
                ? 'bg-brand-soft font-semibold text-brand'
                : 'border border-border-strong font-medium text-muted-foreground',
              step.kind === 'context' &&
                'border border-dashed border-border-strong',
            )}
          >
            {index + 1}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 @2xl/review:flex-row @2xl/review:items-baseline @2xl/review:gap-3">
            <span className="min-w-0 text-sm leading-4.5 font-medium wrap-anywhere @2xl/review:flex-1">
              {step.title}
              <StepMarker step={step} />
            </span>
            {clip(
              step.pointer.path,
              'font-mono text-xs text-muted-foreground @2xl/review:max-w-1/2',
            )}
          </span>
        </button>
      )}
    />
  );
}

function stepMarker(step: ReviewStep) {
  if (step.location.state === 'changed') return 'code moved';
  if (step.location.state === 'broken') return 'broken pointer';
  if (step.kind === 'context') return 'existing code';
  if (step.location.state === 'committed') return 'committed';
  return undefined;
}

function StepMarker({ step }: { step: ReviewStep }): ReactNode {
  const marker = stepMarker(step);
  if (!marker) return null;
  return (
    <span
      className={cn(
        'ml-2 text-xs font-normal text-muted-foreground',
        (step.location.state === 'changed' ||
          step.location.state === 'broken') &&
          'font-medium text-warn',
      )}
    >
      {marker}
    </span>
  );
}
