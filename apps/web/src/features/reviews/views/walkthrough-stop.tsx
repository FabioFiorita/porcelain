import {
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileCodeIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import { type ReactNode, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { MarkdownView } from '@/features/files/index';
import { cn } from '@/shared/lib/utils';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import {
  basename,
  checkResultLabel,
  type CommentAnchor,
  decisionKey,
  decisionLinks,
  type DecisionState,
  decisionRoute,
  filesReviewed,
  neighbourStop,
  orderedChecks,
  proofOnLayer,
  type ReviewChangeItem,
  type ReviewLayer,
  type ReviewStep,
  type RevealComment,
  stopTitle,
  systemChanges,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { LONG_DECISION_SUMMARY } from '@/config/limits';
import { useCompleteDecision } from '../commands/decisions';
import { decisionNotes, gapNotes, mergeNotes } from '../rules/code-notes';
import { spansLabel } from '../rules/patch-focus';
import { ReviewCodeDocument } from './review-code-document';
import { DecisionExcerpts, excerptId } from './walkthrough-excerpt';
import { DecisionQuestion } from './walkthrough-question';
import type { WalkthroughProps } from './walkthrough-props';

type CodeStop = Exclude<WalkthroughStop, { kind: 'briefing' }>;

export function WalkthroughStopView({
  stop,
  stops,
  items,
  decision,
  decisionsSettled,
  finished,
  onGo,
  ...props
}: WalkthroughProps & {
  stop: CodeStop;
  stops: readonly WalkthroughStop[];
  items: readonly ReviewChangeItem[];
  decision: DecisionState | undefined;
  decisionsSettled: boolean;
  finished: boolean;
  onGo: (key: WalkthroughKey) => void;
}) {
  const { review, scope, context, interaction } = props;
  const [reveal, setReveal] = useState<RevealComment>();
  const completion = useCompleteDecision(scope, context, (notice) =>
    toast.add(notice),
  );
  const shown = new Set(stop.paths);
  const files = items.filter((item) => shown.has(item.path));
  const progress = filesReviewed(stop.paths, items);
  const previous = neighbourStop(stops, stop.key, -1);
  const next = neighbourStop(stops, stop.key, 1);
  const layer = stop.kind === 'decision' ? stop.layer : undefined;
  const markDecision = (onDone?: () => void) =>
    completion.complete({
      files,
      ...(onDone ? { onDone } : {}),
      ...(layer
        ? {
            decision: {
              layerId: layer.id,
              fingerprint: layer.fingerprint,
              reviewed: decision?.reviewed === true,
            },
          }
        : {}),
    });
  const remaining = progress.total - progress.reviewed;
  const tally =
    progress.total === 0
      ? 'No changed files of its own'
      : `${progress.reviewed} of ${progress.total} ${progress.total === 1 ? 'file' : 'files'} reviewed here`;
  const advance = () => onGo(next?.key ?? 'briefing');
  const notes = mergeNotes(
    ...review.layers.map((item, index) =>
      item.id === layer?.id
        ? decisionNotes(item)
        : decisionNotes(item, index + 1),
    ),
    stop.kind === 'unexplained'
      ? {}
      : gapNotes(review.notExplained.filter((gap) => shown.has(gap.path))),
  );
  const excerpts =
    stop.kind === 'decision'
      ? stop.layer.steps.filter(
          (step) =>
            step.location.state === 'committed' ||
            (!shown.has(step.pointer.path) &&
              !stop.elsewhere.some((file) => file.path === step.pointer.path)),
        )
      : [];
  const revealStep = (step: ReviewStep) => {
    const item = items.find(
      (candidate) => candidate.path === step.pointer.path,
    );
    const anchor = item && shown.has(item.path) ? stepAnchor(step, item) : null;
    if (anchor) {
      setReveal({ anchor, nonce: Date.now() });
      return;
    }
    const owner =
      stop.kind === 'decision'
        ? stop.elsewhere.find((file) => file.path === step.pointer.path)
        : undefined;
    if (owner) {
      onGo(owner.stop);
      return;
    }
    if (excerpts.includes(step)) {
      document
        .getElementById(excerptId(step))
        ?.scrollIntoView({ block: 'start' });
      return;
    }
    const location =
      step.location.state === 'changed' ? step.pointer : step.location;
    props.onOpen(
      { kind: 'file', path: step.pointer.path },
      {
        kind: 'codeRange',
        filePath: step.pointer.path,
        startLine: location.startLine,
        endLine: location.endLine,
        comparison: { kind: 'file' },
      },
    );
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      role="region"
      aria-label={stopTitle(stop)}
    >
      <ReviewCodeDocument
        scope={scope}
        context={context}
        interaction={{ ...interaction, reveal: reveal ?? interaction.reveal }}
        paths={stop.paths}
        files={stop.paths.map((path) => ({ path }))}
        agentNotes={notes}
        toolbar={(collapseControl) => (
          <nav
            aria-label="Walkthrough stop"
            className="flex shrink-0 items-center gap-1 border-b px-2 py-1"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!previous}
              aria-label={
                previous ? `Previous: ${stopTitle(previous)}` : 'Previous'
              }
              title={
                previous
                  ? `${stopTitle(previous)} (${formatForDisplay(SHORTCUTS.previousStop)})`
                  : undefined
              }
              onClick={() => previous && onGo(previous.key)}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!next}
              aria-label={next ? `Next: ${stopTitle(next)}` : 'Next'}
              title={
                next
                  ? `${stopTitle(next)} (${formatForDisplay(SHORTCUTS.nextStop)})`
                  : undefined
              }
              onClick={advance}
            >
              <ChevronRightIcon />
            </Button>
            <span className="ml-1 min-w-0 flex-1 truncate text-xs text-muted-foreground tabular-nums">
              {tally}
            </span>
            {collapseControl}
            {layer && (
              <Button
                variant={decision?.reviewed ? 'ghost' : 'outline'}
                size="sm"
                aria-pressed={decision?.reviewed === true}
                disabled={!decisionsSettled || completion.pending}
                onClick={() =>
                  decision?.reviewed
                    ? completion.reopen({
                        layerId: layer.id,
                        fingerprint: layer.fingerprint,
                      })
                    : markDecision()
                }
              >
                <CheckIcon data-icon="inline-start" />
                {decision?.reviewed
                  ? 'Decision reviewed'
                  : 'Mark decision reviewed'}
              </Button>
            )}
          </nav>
        )}
        header={() =>
          stop.kind === 'decision' ? (
            <DecisionBrief
              stop={stop}
              total={stops.filter((item) => item.kind === 'decision').length}
              review={review}
              decision={decision}
              onStep={revealStep}
              onGo={onGo}
            />
          ) : stop.kind === 'unexplained' ? (
            <UnexplainedBrief stop={stop} stops={stops} onGo={onGo} />
          ) : (
            <Brief
              eyebrow={
                <span className="tracking-wide uppercase">
                  Set apart by your settings
                </span>
              }
              title="Specs"
              lead="Specs are folded because agents follow the project's spec rules. Open the ones that matter to you; the countdown still includes them."
            />
          )
        }
        footer={() => (
          <>
            {stop.kind === 'decision' && (
              <DecisionExcerpts
                scope={scope}
                context={context}
                interaction={interaction}
                onOpen={props.onOpen}
                layer={stop.layer}
                steps={excerpts}
              />
            )}
            <div className="mt-3 border-t bg-muted/20">
              <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-5 pt-5 pb-16 font-sans">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {finished
                      ? 'All reviewed here'
                      : layer
                        ? 'Done with this decision?'
                        : 'Done here?'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {finished
                      ? next
                        ? `Next: ${stopTitle(next)}`
                        : 'This was the last stop.'
                      : remaining > 0
                        ? `Marks the ${remaining} remaining ${remaining === 1 ? 'file' : 'files'} here reviewed${layer ? ' and records the decision' : ''}.`
                        : progress.total === 0
                          ? 'Records the decision. Its code is shown in other stops.'
                          : 'Its files are reviewed; this records the decision.'}
                  </p>
                </div>
                <Button
                  disabled={completion.pending || (layer && !decisionsSettled)}
                  onClick={() => (finished ? advance() : markDecision(advance))}
                >
                  {finished
                    ? next
                      ? 'Continue'
                      : 'Back to the briefing'
                    : next
                      ? 'Mark reviewed and continue'
                      : 'Mark reviewed and finish'}
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </div>
            </div>
          </>
        )}
      />
    </div>
  );
}

function stepAnchor(
  step: ReviewStep,
  item: ReviewChangeItem,
): CommentAnchor | null {
  const scope = (['unstaged', 'staged', 'untracked'] as const).find((value) =>
    item.comparisons.some((change) => change.scope === value),
  );
  if (!scope) return null;
  const comparison = { kind: 'worktree' as const, scope };
  return step.location.state === 'current'
    ? {
        kind: 'codeRange',
        filePath: item.path,
        startLine: step.location.startLine,
        endLine: step.location.endLine,
        side: 'additions',
        comparison,
      }
    : { kind: 'file', filePath: item.path, comparison };
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
  onStep,
  onGo,
}: {
  stop: Extract<WalkthroughStop, { kind: 'decision' }>;
  total: number;
  review: WalkthroughProps['review'];
  decision: DecisionState | undefined;
  onStep: (step: ReviewStep) => void;
  onGo: (key: WalkthroughKey) => void;
}) {
  const { layer } = stop;
  const route = decisionRoute(layer);
  const links = decisionLinks(review, layer.id);
  const questions = [
    ...systemChanges(review).questions.filter(
      (part) => part.decision === stop.number,
    ),
    ...links.flatMap((link) => (link.part.problem ? [link.part] : [])),
  ].filter(
    (part, index, all) =>
      all.findIndex((other) => other.id === part.id) === index,
  );
  const proof = proofOnLayer(review.proof, layer.id);
  return (
    <Brief
      eyebrow={
        <>
          <span className="tracking-wide uppercase">
            Decision {stop.number} of {total}
          </span>
          {decision?.reviewed && (
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
                  {link.change === 'new'
                    ? 'New'
                    : link.change === 'changed'
                      ? 'Changed'
                      : 'Removed'}
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
