import {
  ArrowRightIcon,
  CheckIcon,
  FileCodeIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarkdownView } from '@/features/files/index';
import { cn } from '@/shared/lib/utils';
import { LONG_DECISION_SUMMARY } from '@/config/limits';
import { spansLabel } from '@porcelain/client/changes/rules';
import {
  basename,
  checkResultLabel,
  decisionKey,
  decisionLinks,
  decisionQuestions,
  decisionRoute,
  orderedChecks,
  proofOnLayer,
  stopTitle,
  type DecisionState,
  type ReviewLayer,
  type ReviewStep,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { DecisionQuestion } from './walkthrough-question';
import type { WalkthroughProps } from './walkthrough-props';
type CodeStop = Exclude<WalkthroughStop, { kind: 'briefing' }>;

export function StopBrief({
  stop,
  stops,
  review,
  decision,
  finished,
  onStep,
  onGo,
}: {
  stop: CodeStop;
  stops: readonly WalkthroughStop[];
  review: WalkthroughProps['review'];
  decision: DecisionState | undefined;
  finished: boolean;
  onStep: (step: ReviewStep) => void;
  onGo: (key: WalkthroughKey) => void;
}) {
  if (stop.kind === 'decision') {
    return (
      <DecisionBrief
        stop={stop}
        total={stops.filter((item) => item.kind === 'decision').length}
        review={review}
        decision={decision}
        finished={finished}
        onStep={onStep}
        onGo={onGo}
      />
    );
  }
  if (stop.kind === 'unexplained') {
    return <UnexplainedBrief stop={stop} stops={stops} onGo={onGo} />;
  }
  return (
    <Brief
      eyebrow={
        <span className="tracking-wide uppercase">
          Set apart by your settings
        </span>
      }
      title="Specs"
      lead="Specs are folded because agents follow the project's spec rules. Open the ones that matter to you; the countdown still includes them."
    />
  );
}

function changeLabel(change: 'new' | 'changed' | 'removed') {
  if (change === 'new') return 'New';
  if (change === 'changed') return 'Changed';
  return 'Removed';
}

function Brief({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: ReactNode;
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b bg-muted/20">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-5 pt-6 pb-5 font-sans">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-2xs font-medium text-muted-foreground">
            {eyebrow}
          </div>
          <h2 className="text-xl leading-tight font-semibold text-balance">
            {title}
          </h2>
          {lead && (
            <div className="max-w-3xl text-sm text-muted-foreground text-pretty">
              {lead}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function DecisionBrief({
  stop,
  total,
  review,
  decision,
  finished,
  onStep,
  onGo,
}: {
  stop: Extract<WalkthroughStop, { kind: 'decision' }>;
  total: number;
  review: WalkthroughProps['review'];
  decision: DecisionState | undefined;
  finished: boolean;
  onStep: (step: ReviewStep) => void;
  onGo: (key: WalkthroughKey) => void;
}) {
  const { layer } = stop;
  const route = decisionRoute(layer);
  const links = decisionLinks(review, layer.id);
  const questions = decisionQuestions(review, stop);
  const proof = proofOnLayer(review.proof, layer.id);
  return (
    <Brief
      eyebrow={
        <>
          <span className="tracking-wide uppercase">
            Decision {stop.number} of {total}
          </span>
          {finished && (
            <Badge variant="outline">
              <CheckIcon className="text-graph-2" /> Reviewed
            </Badge>
          )}
          {decision?.stale && (
            <Badge variant="outline">
              <TriangleAlertIcon className="text-graph-4" /> Code moved since it
              was explained
            </Badge>
          )}
        </>
      }
      title={layer.title}
      lead={<Summary text={layer.summary} />}
    >
      {route.length > 0 && (
        <ol
          aria-label="Route through the system"
          className="flex flex-wrap items-center gap-1.5"
        >
          {route.map((lane, index) => (
            <li key={`${lane}:${index}`} className="flex items-center gap-1.5">
              {index > 0 && (
                <ArrowRightIcon
                  className="size-3 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <Badge variant="secondary">{lane}</Badge>
            </li>
          ))}
        </ol>
      )}
      {links.length > 0 && (
        <ul aria-label="Connections" className="flex flex-wrap gap-1.5">
          {links.map((link) => (
            <li
              key={link.part.id}
              className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
            >
              <span className="text-muted-foreground">
                {link.outgoing ? link.verb : `${link.part.label} ${link.verb}`}
              </span>
              {link.outgoing && (
                <span className="font-medium">{link.part.label}</span>
              )}
              {link.change && (
                <span
                  className={cn(
                    'rounded px-1 text-2xs font-medium',
                    link.change === 'new' && 'bg-graph-2/12 text-graph-2',
                    link.change === 'changed' && 'bg-graph-1/12 text-graph-1',
                    link.change === 'removed' &&
                      'bg-destructive/10 text-destructive',
                  )}
                >
                  {changeLabel(link.change)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {questions.map((part) => (
        <DecisionQuestion key={part.id} part={part} />
      ))}
      <StepList layer={layer} onStep={onStep} />
      {stop.elsewhere.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>Also changes</span>
          {stop.elsewhere.map((file) => (
            <Button
              key={file.path}
              variant="outline"
              size="xs"
              title={file.path}
              onClick={() => onGo(file.stop)}
            >
              {basename(file.path)}
              <span className="text-muted-foreground">
                {file.stop === 'specs'
                  ? '· in Specs'
                  : `· shown in decision ${review.layers.findIndex((item) => decisionKey(item.id) === file.stop) + 1}`}
              </span>
            </Button>
          ))}
        </div>
      )}
      {proof.checks.length > 0 && (
        <ul
          aria-label="Checks for this decision"
          className="flex flex-wrap gap-1.5"
        >
          {orderedChecks(proof.checks).map((check) => (
            <li
              key={check.name}
              className={cn(
                'rounded-md border px-2 py-1 text-xs',
                check.result === 'fail' &&
                  'border-destructive/40 text-destructive',
              )}
            >
              {check.name} · {checkResultLabel(check.result)}
            </li>
          ))}
        </ul>
      )}
    </Brief>
  );
}

function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > LONG_DECISION_SUMMARY;
  return (
    <div className="flex flex-col items-start gap-1">
      <MarkdownView
        text={text}
        className={cn('text-sm', long && !open && 'line-clamp-3')}
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

function StepList({
  layer,
  onStep,
}: {
  layer: ReviewLayer;
  onStep: (step: ReviewStep) => void;
}) {
  return (
    <ol
      aria-label="Steps"
      className="grid grid-cols-2 gap-1.5 max-narrow:grid-cols-1"
    >
      {layer.steps.map((step, index) => (
        <li key={step.id}>
          <button
            type="button"
            aria-label={`Go to step ${index + 1}: ${step.title}`}
            onClick={() => onStep(step)}
            className="flex w-full items-start gap-2.5 rounded-lg border bg-background px-2.5 py-2 text-left hover:border-foreground/20 hover:bg-accent/40"
          >
            <span
              className={cn(
                'mt-px grid size-5 shrink-0 place-items-center rounded-full bg-graph-1/12 text-2xs font-semibold text-graph-1 tabular-nums',
                step.kind === 'context' && 'bg-muted text-muted-foreground',
              )}
            >
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-caption font-medium">{step.title}</span>
              <span className="flex min-w-0 items-center gap-1 text-2xs text-muted-foreground">
                <FileCodeIcon className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate" title={step.pointer.path}>
                  {step.pointer.path}
                </span>
              </span>
              <span className="text-2xs text-muted-foreground">
                {layer.lanes[step.lane]}
                {step.kind === 'context' && ' · existing code'}
                {step.location.state === 'changed' && (
                  <span className="text-graph-4"> · code moved</span>
                )}
                {step.location.state === 'broken' && (
                  <span className="text-graph-4"> · broken pointer</span>
                )}
                {step.location.state === 'committed' && ' · committed'}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function UnexplainedBrief({
  stop,
  stops,
  onGo,
}: {
  stop: Extract<WalkthroughStop, { kind: 'unexplained' }>;
  stops: readonly WalkthroughStop[];
  onGo: (key: WalkthroughKey) => void;
}) {
  const where = (key: WalkthroughKey) => {
    const found = stops.find((item) => item.key === key);
    return found ? stopTitle(found) : key;
  };
  return (
    <Brief
      eyebrow={
        <span className="tracking-wide uppercase">After the decisions</span>
      }
      title="Not explained"
      lead={
        stop.paths.length > 0
          ? `${stop.paths.length} changed ${stop.paths.length === 1 ? 'file has' : 'files have'} no decision pointing at ${stop.paths.length === 1 ? 'it' : 'them'}. Read ${stop.paths.length === 1 ? 'it' : 'them'} before calling the review done, or ask the agent to explain.`
          : 'Every changed file belongs to a decision, but some lines inside them have no explanation.'
      }
    >
      {stop.partial.length > 0 && (
        <ul
          aria-label="Unexplained lines in explained files"
          className="flex flex-col gap-1.5"
        >
          {stop.partial.map((gap) => (
            <li
              key={gap.path}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-graph-4/40 bg-graph-4/5 px-3 py-2 text-sm"
            >
              <TriangleAlertIcon className="size-4 shrink-0 text-graph-4" />
              <span className="min-w-0 flex-1 break-all" title={gap.path}>
                {gap.path}
                <span className="text-muted-foreground">
                  {' · '}
                  {gap.ranges.length > 0
                    ? spansLabel(gap.ranges)
                    : 'whole file'}
                </span>
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => onGo(gap.stop)}
              >
                Read in {where(gap.stop)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Brief>
  );
}
