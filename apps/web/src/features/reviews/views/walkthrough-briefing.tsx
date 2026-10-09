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
import { cn } from '@/shared/lib/utils';
import {
  decisionKey,
  type DecisionState,
  decisionRoute,
  filesReviewed,
  proofLabel,
  proofStatus,
  type ReviewChangeItem,
  type SystemPart,
  stopName,
  stopTitle,
  systemChanges,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { PROOF } from '../rules/documents';
import { DecisionQuestion } from './walkthrough-question';
import type { WalkthroughProps } from './walkthrough-props';

export function WalkthroughBriefing({
  review,
  stops,
  items,
  decisions,
  done: isDone,
  onGo,
  onOpen,
}: WalkthroughProps & {
  stops: readonly WalkthroughStop[];
  items: readonly ReviewChangeItem[];
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
  const proof = proofStatus(review.proof);
  const attention = [
    ...(parts.questions.length > 0
      ? [`${parts.questions.length} to decide`]
      : []),
    ...(stale > 0 ? [`${stale} moved`] : []),
    ...(unexplained ? ['unexplained changes'] : []),
  ];
  const hasParts =
    parts.added.length + parts.changed.length + parts.removed.length > 0;
  return (
    <div
      className="min-h-0 flex-1 overflow-auto"
      aria-label="Briefing"
      role="region"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-9 px-6 pt-8 pb-16">
        <header className="flex flex-col gap-4">
          <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
            Briefing · revision {review.revision}
          </p>
          <h2 className="text-2xl leading-tight font-semibold text-balance">
            {decisionStops.length}{' '}
            {decisionStops.length === 1 ? 'decision' : 'decisions'} shape this
            change
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
            Read each decision through its code and mark it reviewed. Every
            changed file belongs to exactly one stop, and changes no decision
            explains come last, so finishing the walkthrough means nothing was
            left out.
          </p>
          <dl className="grid grid-cols-3 gap-2">
            <Stat
              label="Files reviewed"
              value={`${total.reviewed} / ${total.total}`}
              fraction={total.total === 0 ? 0 : total.reviewed / total.total}
            />
            <Stat
              label="Decisions reviewed"
              value={`${done} / ${decisionStops.length}`}
              fraction={
                decisionStops.length === 0 ? 0 : done / decisionStops.length
              }
            />
            <Stat
              label="Needs attention"
              value={`${parts.questions.length + stale + (unexplained ? 1 : 0)}`}
              caption={attention.join(' · ') || 'Nothing'}
              tone={
                parts.questions.length + stale > 0 || unexplained
                  ? 'warning'
                  : 'calm'
              }
            />
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            {next ? (
              <Button onClick={() => onGo(next.key)}>
                {done === 0 && total.reviewed === 0
                  ? 'Start with'
                  : 'Continue with'}{' '}
                {stopTitle(next)}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-medium text-graph-2">
                <CheckIcon className="size-4" /> Everything in this change is
                reviewed
              </p>
            )}
          </div>
        </header>

        {(hasParts || parts.questions.length > 0) && (
          <section
            aria-labelledby="briefing-system"
            className="flex flex-col gap-3"
          >
            <SectionTitle id="briefing-system">
              What this adds to the system
            </SectionTitle>
            {parts.questions.map((part) => (
              <DecisionQuestion
                key={`question:${part.id}`}
                part={part}
                action={
                  <DecisionLink part={part} review={review} onGo={onGo} />
                }
              />
            ))}
            {hasParts && (
              <div className="grid grid-cols-3 gap-2 max-narrow:grid-cols-1">
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
            )}
          </section>
        )}

        <section
          aria-labelledby="briefing-decisions"
          className="flex flex-col gap-2"
        >
          <SectionTitle id="briefing-decisions">The walkthrough</SectionTitle>
          <ol className="flex flex-col divide-y rounded-xl border">
            {decisionStops.map((stop) => {
              const state = decisions.get(stop.layer.id);
              const progress = filesReviewed(stop.paths, items);
              return (
                <li key={stop.key}>
                  <button
                    type="button"
                    onClick={() => onGo(stop.key)}
                    className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-accent/50"
                  >
                    <StopMark done={isDone(stop)} label={`${stop.number}`} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {stop.layer.title}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
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
                  </button>
                </li>
              );
            })}
            {after.map((stop) => {
              const progress = filesReviewed(stop.paths, items);
              return (
                <li key={stop.key}>
                  <button
                    type="button"
                    onClick={() => onGo(stop.key)}
                    className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-accent/50"
                  >
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
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-medium">
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
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          aria-labelledby="briefing-evidence"
          className="flex flex-col gap-2"
        >
          <SectionTitle id="briefing-evidence">Evidence</SectionTitle>
          <div className="flex items-center gap-3 rounded-xl border px-3.5 py-3">
            <FlaskConicalIcon
              className={cn(
                'size-4 shrink-0 text-muted-foreground',
                proof.failing > 0 && 'text-destructive',
              )}
            />
            <p className="min-w-0 flex-1 text-sm">
              Checks the agent ran ·{' '}
              <span
                className={cn(
                  'text-muted-foreground',
                  proof.failing > 0 && 'font-medium text-destructive',
                )}
              >
                {proofLabel(proof)}
              </span>
            </p>
            <Button variant="outline" size="sm" onClick={() => onOpen(PROOF)}>
              Open proof
            </Button>
          </div>
        </section>
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

function Stat({
  label,
  value,
  fraction,
  caption,
  tone = 'calm',
}: {
  label: string;
  value: string;
  fraction?: number;
  caption?: string;
  tone?: 'calm' | 'warning';
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border px-3.5 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-xl font-semibold tabular-nums',
          tone === 'warning' && 'text-graph-4',
        )}
      >
        {value}
      </dd>
      {caption && (
        <span className="text-2xs text-muted-foreground">{caption}</span>
      )}
      {fraction !== undefined && (
        <span className="block h-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-graph-2"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </span>
      )}
    </div>
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
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {title}
        <span className="text-muted-foreground tabular-nums">
          {parts.length}
        </span>
      </p>
      {parts.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {parts.map((part) => (
            <li key={part.id} className="flex flex-col gap-0.5">
              <span
                className={cn(
                  'text-sm font-medium',
                  struck && 'text-muted-foreground line-through',
                )}
              >
                {part.label}
              </span>
              {part.detail && (
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {part.detail}
                </span>
              )}
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
