import { type ReactNode, useState } from 'react';
import { SparklesIcon } from 'lucide-react';
import { AsyncResult } from 'effect/reactivity';
import { shortOid } from '@porcelain/client/history/rules';
import { counted } from '@porcelain/client/reviews/rules';
import {
  stopPaths,
  walkthroughCalls,
  walkthroughFailureCopy,
  walkthroughFileCount,
  walkthroughVerdict,
  type WalkthroughContent,
  type WalkthroughFailure,
  type WalkthroughRun,
  type WalkthroughStop,
} from '@porcelain/client/walkthroughs/rules';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { BRANCH, type DocumentProps } from '@/features/workspace/index';
import { cn } from '@/shared/lib/utils';
import { StateFailure, StateSkeleton } from '@/shared/views/state-notice';
import { useStartWalkthrough } from '../commands/start-walkthrough';
import { useWalkthrough } from '../queries/walkthrough';
import { RichText } from './rich-text';
import { WalkthroughProof } from './walkthrough-evidence';

const GROWTH_SIGNS = { added: '+', changed: '~', removed: '−' } as const;
const GROWTH_SHOWN = 4;
const NOT_SAID_SHOWN = 3;

const KIND_LABELS: Record<
  NonNullable<WalkthroughStop['attention']>['kind'],
  string
> = {
  product: 'Product call',
  contract: 'Contract call',
  tradeoff: 'Tradeoff',
  risk: 'Risk to accept',
  accessibility: 'Accessibility call',
};

const scrollToId = (id: string) =>
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const stepId = (step: number) => `walkthrough-step-${step}`;

function Column({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-180 flex-col gap-10 px-5 py-8 @3xl:px-8 @3xl:py-12">
      {children}
    </div>
  );
}

function Meta({
  run,
  content,
}: {
  run: WalkthroughRun;
  content?: WalkthroughContent;
}) {
  const parts = [
    ...(run.pullRequestNumber === undefined
      ? []
      : [`#${run.pullRequestNumber}`]),
    ...(content && walkthroughFileCount(content) > 0
      ? [counted(walkthroughFileCount(content), 'file')]
      : []),
    `written for ${shortOid(run.headOid)}`,
  ];
  return (
    <p className="font-mono text-caption text-muted-foreground">
      {parts.join(' · ')}
    </p>
  );
}

function Headline({ content }: { content: WalkthroughContent }) {
  return (
    <h1 className="text-subpage-title font-semibold tracking-tight text-balance @3xl:text-page-title">
      <span className="text-muted-foreground">
        {content.title.replace(/\.$/, '')}.
      </span>{' '}
      {walkthroughVerdict(content)}
    </h1>
  );
}

function FoldedLink({
  hidden,
  onClick,
}: {
  hidden: number;
  onClick: () => void;
}) {
  return (
    <div className="-ml-2">
      <Button variant="link" size="sm" onClick={onClick}>
        {hidden} more
      </Button>
    </div>
  );
}

function Growth({ items }: { items: WalkthroughContent['growth'] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, GROWTH_SHOWN);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-ui font-semibold">How the system grew</h2>
      <ul className="flex flex-col gap-1.5">
        {shown.map((item, index) => (
          <li
            key={`${index}:${item.what}`}
            className="grid grid-cols-[1rem_minmax(0,1fr)] text-prose"
          >
            <span
              aria-label={item.change}
              className={cn(
                'font-mono',
                item.change === 'added' && 'text-add-fg',
                item.change === 'removed' && 'text-del-fg',
                item.change === 'changed' && 'text-muted-foreground',
              )}
            >
              {GROWTH_SIGNS[item.change]}
            </span>
            <span className="wrap-anywhere">
              <span className="font-medium">
                <RichText text={item.what} />.
              </span>{' '}
              <span className="text-foreground-2">
                <RichText text={item.note} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      {items.length > GROWTH_SHOWN && !open && (
        <FoldedLink
          hidden={items.length - GROWTH_SHOWN}
          onClick={() => setOpen(true)}
        />
      )}
    </section>
  );
}

function NotSaid({ content }: { content: WalkthroughContent }) {
  const [open, setOpen] = useState(false);
  const total = content.onlyInTranscript.length + content.stillUnclear.length;
  if (total === 0) return null;
  const explained = open
    ? content.onlyInTranscript
    : content.onlyInTranscript.slice(0, NOT_SAID_SHOWN);
  const unclear = open
    ? content.stillUnclear
    : content.stillUnclear.slice(
        0,
        Math.max(0, NOT_SAID_SHOWN - explained.length),
      );
  return (
    <section className="flex flex-col gap-2 border-t pt-5">
      <h2 className="text-ui font-semibold">What the code doesn&apos;t say</h2>
      <ul className="flex flex-col gap-2 text-prose">
        {explained.map((item, index) => (
          <li key={`${index}:${item.point}`}>
            <span>
              <RichText text={item.point} />
            </span>{' '}
            <span className="text-foreground-2">
              <RichText text={item.answer} />
            </span>
          </li>
        ))}
        {unclear.map((item, index) => (
          <li key={`${index}:${item}`} className="text-foreground-2">
            <RichText text={item} />
          </li>
        ))}
      </ul>
      {!open && total > NOT_SAID_SHOWN && (
        <FoldedLink
          hidden={total - NOT_SAID_SHOWN}
          onClick={() => setOpen(true)}
        />
      )}
    </section>
  );
}

function Calls({
  content,
  conversation,
}: {
  content: WalkthroughContent;
  conversation: Conversation | undefined;
}) {
  const calls = walkthroughCalls(content);
  if (calls.length === 0) return null;
  return (
    <section id="your-calls" className="flex scroll-mt-6 flex-col gap-3">
      {calls.map(({ attention, step }) => (
        <article
          key={step}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 @3xl:p-5"
        >
          <div className="flex items-baseline justify-between gap-3 text-caption text-muted-foreground">
            <span>{KIND_LABELS[attention.kind]}</span>
            <button
              type="button"
              className="hover:text-foreground"
              onClick={() => scrollToId(stepId(step))}
            >
              Step {step}
            </button>
          </div>
          <h2 className="text-section font-semibold text-pretty">
            <RichText text={attention.question} />
          </h2>
          <p className="text-prose text-foreground-2">
            <RichText text={attention.note} />
          </p>
          {conversation?.({ kind: 'call', step })}
        </article>
      ))}
    </section>
  );
}

type Conversation = (target: {
  kind: 'call' | 'step';
  step: number;
}) => ReactNode;

function Step({
  stop,
  step,
  run,
  props,
  conversation,
}: {
  stop: WalkthroughStop;
  step: number;
  run: WalkthroughRun;
  props: DocumentProps;
  conversation: Conversation | undefined;
}) {
  return (
    <li
      id={stepId(step)}
      className="flex scroll-mt-6 flex-col gap-2.5 border-t pt-5"
    >
      <p className="font-mono text-caption text-muted-foreground">
        Step {step}
        {stop.attention && (
          <button
            type="button"
            className="ml-2 text-foreground hover:underline"
            onClick={() => scrollToId('your-calls')}
          >
            Your call
          </button>
        )}
      </p>
      <h2 className="text-lg leading-6 font-semibold text-pretty">
        <RichText text={stop.title} />
      </h2>
      <p className="text-prose text-foreground-2">
        <RichText text={stop.explanation} />
      </p>
      {stop.evidence.length > 0 && (
        <WalkthroughProof
          scope={props.scope}
          context={props.context}
          run={run}
          items={stop.evidence}
        />
      )}
      {stopPaths(stop).length > 0 && (
        <div className="-ml-2">
          <Button
            variant="link"
            size="sm"
            aria-label={`See the code for step ${step}`}
            onClick={() => props.onOpen({ kind: 'walkthrough-step', step })}
          >
            See the code
          </Button>
        </div>
      )}
      {conversation?.({ kind: 'step', step })}
    </li>
  );
}

function Written({
  run,
  content,
  outOfDate,
  props,
  onUpdate,
  updating,
  updateFailure,
}: {
  run: WalkthroughRun;
  content: WalkthroughContent;
  outOfDate: boolean;
  props: DocumentProps;
  onUpdate: () => void;
  updating: boolean;
  updateFailure: WalkthroughFailure | undefined;
}) {
  let notice = (
    <>
      <span>New commits landed after this was written.</span>
      <Button size="sm" variant="outline" onClick={onUpdate}>
        Update walkthrough
      </Button>
    </>
  );
  if (updating) notice = <span role="status">Updating…</span>;
  else if (updateFailure)
    notice = (
      <>
        <span role="alert">
          {walkthroughFailureCopy(updateFailure, run.writer).title}{' '}
          {updateFailure.message}
        </span>
        <Button size="sm" variant="outline" onClick={onUpdate}>
          Try again
        </Button>
      </>
    );
  const stale = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ui text-foreground-2">
      {notice}
    </div>
  );
  if (content.outcome === 'nothing')
    return (
      <Column>
        <header className="flex flex-col gap-3">
          <Meta run={run} content={content} />
          <Headline content={content} />
          <p className="text-prose text-foreground-2">
            <RichText text={content.summary} />
          </p>
          {(outOfDate || updating || updateFailure) && stale}
          <div className="-ml-2">
            <Button
              variant="link"
              size="sm"
              onClick={() => props.onOpen(BRANCH)}
            >
              See the change
            </Button>
          </div>
        </header>
      </Column>
    );
  return (
    <Column>
      <header className="flex flex-col gap-3">
        <Meta run={run} content={content} />
        <Headline content={content} />
        <p className="text-prose text-foreground-2">
          <RichText text={content.summary} />
        </p>
        {(outOfDate || updating || updateFailure) && stale}
      </header>
      <Calls content={content} conversation={undefined} />
      {content.growth.length > 0 && <Growth items={content.growth} />}
      <ol className="flex flex-col gap-10">
        {content.stops.map((stop, index) => (
          <Step
            key={index}
            stop={stop}
            step={index + 1}
            run={run}
            props={props}
            conversation={undefined}
          />
        ))}
      </ol>
      <NotSaid content={content} />
      <footer className="border-t pt-5">
        <div className="-ml-2">
          <Button variant="link" size="sm" onClick={() => props.onOpen(BRANCH)}>
            See every changed file
          </Button>
        </div>
      </footer>
    </Column>
  );
}

function Unwritten({
  waiting,
  onWrite,
}: {
  waiting: boolean;
  onWrite: () => void;
}) {
  return (
    <Column>
      <header className="flex flex-col items-start gap-3">
        <h1 className="text-subpage-title font-semibold tracking-tight @3xl:text-page-title">
          No walkthrough yet.
        </h1>
        <p className="text-prose text-foreground-2">
          A fresh agent reads this change and explains it. It never edits the
          code.
        </p>
        <Button disabled={waiting} onClick={onWrite}>
          <SparklesIcon data-icon="inline-start" />
          Write walkthrough
        </Button>
      </header>
    </Column>
  );
}

function Writing({ run }: { run: WalkthroughRun }) {
  return (
    <Column>
      <header role="status" className="flex flex-col gap-3">
        <Meta run={run} />
        <p className="flex items-center gap-2 text-prose text-foreground-2">
          <Spinner />
          Reading the change
        </p>
        <Skeleton className="h-9 w-4/5" />
        <Skeleton className="h-20 w-full" />
      </header>
    </Column>
  );
}

function Failed({
  run,
  failure,
  waiting,
  onRetry,
}: {
  run: WalkthroughRun | undefined;
  failure: WalkthroughFailure;
  waiting: boolean;
  onRetry: () => void;
}) {
  const copy = walkthroughFailureCopy(
    failure,
    run?.writer ?? { provider: 'claude', model: '', effort: 'high' },
  );
  return (
    <Column>
      <header className="flex flex-col items-start gap-3">
        <h1 className="text-subpage-title font-semibold tracking-tight">
          {copy.title}
        </h1>
        <p className="text-prose text-foreground-2">
          {copy.message}
          {copy.command && (
            <>
              {' '}
              <code className="font-mono text-caption">{copy.command}</code> on
              this computer, then try again.
            </>
          )}
        </p>
        <Button disabled={waiting} onClick={onRetry}>
          Try again
        </Button>
      </header>
    </Column>
  );
}

export function WalkthroughDocument(props: DocumentProps) {
  const { result, phase, refresh } = useWalkthrough(props.scope, props.context);
  const write = useStartWalkthrough(props.scope, props.context, props.base);
  if (phase === undefined)
    return AsyncResult.isFailure(result) ? (
      <StateFailure
        description="The walkthrough could not be read."
        onRetry={refresh}
      />
    ) : (
      <StateSkeleton label="Loading walkthrough" />
    );
  const body = () => {
    const startFailure =
      write.failure && (phase.kind === 'unwritten' || phase.kind === 'failed')
        ? write.failure
        : undefined;
    if (startFailure)
      return (
        <Failed
          run={phase.kind === 'failed' ? phase.run : undefined}
          failure={startFailure}
          waiting={write.waiting}
          onRetry={write.start}
        />
      );
    switch (phase.kind) {
      case 'unwritten':
        return <Unwritten waiting={write.waiting} onWrite={write.start} />;
      case 'writing':
        return <Writing run={phase.run} />;
      case 'failed':
        return (
          <Failed
            run={phase.run}
            failure={phase.failure}
            waiting={write.waiting}
            onRetry={write.start}
          />
        );
      case 'ready':
        return (
          <Written
            run={phase.run}
            content={phase.content}
            outOfDate={phase.outOfDate}
            props={props}
            onUpdate={write.start}
            updating={
              write.waiting ||
              phase.attempt?.state.status === 'queued' ||
              phase.attempt?.state.status === 'running'
            }
            updateFailure={
              write.failure ??
              (phase.attempt?.state.status === 'failed'
                ? phase.attempt.state.failure
                : undefined)
            }
          />
        );
    }
  };
  return <div className="@container h-full overflow-auto">{body()}</div>;
}
