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
import { AnswerableQuestion } from './walkthrough-question';
import { MarginRow } from './margin-row';
import { StateNotice } from '@/shared/views/state-notice';
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
            <AnswerableQuestion
              key={part.id}
              part={part}
              revision={revision}
              scope={scope}
              context={context}
              compact
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
        <header className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Decision {stop.number} of {total}
            </span>
            {questions.length > 0 && (
              <Badge variant="outline">
                <CircleHelpIcon className="text-graph-1" /> Needs your decision
              </Badge>
            )}
            {decision?.stale && (
              <Badge variant="outline">
                <TriangleAlertIcon className="text-graph-4" /> Code moved
              </Badge>
            )}
            {finished && (
              <Badge variant="outline">
                <CheckIcon className="text-graph-2" /> Reviewed
              </Badge>
            )}
          </div>
          <h2 className="text-3xl leading-tight font-semibold tracking-tight wrap-anywhere">
            <span aria-hidden="true" className="text-muted-foreground">
              {stop.number}.{' '}
            </span>
            {layer.title}
          </h2>
          <Summary text={layer.summary} />
        </header>
        {decision?.stale && (
          <StateNotice
            role="status"
            title="Code moved since it was explained"
            description="Lines this decision points at changed after the agent explained them. Read the diff below, or ask the agent to publish a revision."
          />
        )}
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

function changeVariant(change: NonNullable<DecisionLink['change']>) {
  if (change === 'new') return 'default';
  if (change === 'changed') return 'outline';
  return 'destructive';
}

function changeLabel(change: NonNullable<DecisionLink['change']>) {
  if (change === 'new') return 'New';
  if (change === 'changed') return 'Changed';
  return 'Removed';
}

function Contracts({ links }: { links: readonly DecisionLink[] }) {
  return (
    <section aria-label="Contracts" className="flex min-w-0 flex-col gap-2">
      <h3 className="border-b pb-2 font-medium text-muted-foreground">
        Contracts
      </h3>
      <ul
        aria-label="Connections"
        className="flex flex-wrap gap-1.5 @5xl/review:flex-col @5xl/review:gap-0 @5xl/review:divide-y"
      >
        {links.map((link) => (
          <li
            key={link.part.id}
            className="flex min-w-0 items-center gap-1.5 rounded-md border bg-background px-2 py-1 @5xl/review:items-start @5xl/review:justify-between @5xl/review:rounded-none @5xl/review:border-0 @5xl/review:bg-transparent @5xl/review:px-0 @5xl/review:py-2.5"
          >
            <span className="flex min-w-0 items-baseline gap-1.5 wrap-anywhere @5xl/review:flex-col @5xl/review:gap-0.5">
              <span className="text-muted-foreground">
                {link.outgoing ? link.verb : `${link.part.label} ${link.verb}`}
              </span>
              {link.outgoing && (
                <span className="text-caption font-medium text-foreground">
                  {link.part.label}
                </span>
              )}
            </span>
            {link.change && (
              <Badge variant={changeVariant(link.change)}>
                {changeLabel(link.change)}
              </Badge>
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
    <div className="flex flex-col items-start gap-1">
      <MarkdownView
        text={text}
        className={cn('text-base text-pretty', long && !open && 'line-clamp-3')}
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
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2 text-xs">
        <span className="text-muted-foreground tabular-nums">
          {layer.steps.length} {layer.steps.length === 1 ? 'step' : 'steps'}
        </span>
        {route.length > 0 && (
          <ol className="order-last flex min-w-0 basis-full flex-wrap items-center gap-1.5 font-medium @2xl/review:order-none @2xl/review:flex-1 @2xl/review:basis-auto">
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
        <span className="ml-auto text-muted-foreground tabular-nums">
          {reviewed} of {total} files reviewed here
        </span>
      </div>
      <ol aria-label="Steps" className="flex flex-col">
        {layer.steps.map((step, index) => (
          <li key={step.id}>
            <RouteRow
              step={step}
              index={index}
              lane={
                index === 0 || layer.steps[index - 1]?.lane !== step.lane
                  ? layer.lanes[step.lane]
                  : undefined
              }
              onStep={onStep}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function RouteRow({
  step,
  index,
  lane,
  onStep,
}: {
  step: ReviewStep;
  index: number;
  lane: string | undefined;
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
          onClick={() => onStep(step)}
          className={cn(
            'flex w-full min-w-0 items-start gap-3 py-2 text-left hover:bg-accent/50 @2xl/review:items-baseline',
            lane !== undefined && index > 0 && 'border-t',
          )}
        >
          {clip(
            lane ?? '',
            'hidden w-24 shrink-0 text-xs text-muted-foreground @2xl/review:block',
          )}
          <span
            className={cn(
              'grid size-5 shrink-0 place-items-center rounded-full border text-2xs font-semibold text-graph-1 tabular-nums',
              step.kind === 'context' && 'border-dashed text-muted-foreground',
            )}
          >
            {index + 1}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 @2xl/review:flex-row @2xl/review:items-baseline @2xl/review:gap-3">
            <span className="min-w-0 text-sm font-medium wrap-anywhere @2xl/review:flex-1">
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
          'text-graph-4',
      )}
    >
      {marker}
    </span>
  );
}
