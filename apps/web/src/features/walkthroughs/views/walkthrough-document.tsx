import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { type ReactNode, useState } from 'react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  attentionLabel,
  failureCopy,
  foldedGrowth,
  foldedNotSaid,
  growthSign,
  readyUpdate,
  initialWriteFailure,
  reviewCodeSections,
  walkthroughCalls,
  walkthroughMeta,
  walkthroughEvidenceNotice,
  acknowledgedWalkthrough,
  walkthroughPhase,
  walkthroughVerdict,
  type ReviewCode as ReviewCodeFiles,
  type WalkthroughContent,
  type WalkthroughFailure,
  type WalkthroughRun,
  type WalkthroughStop,
} from '@porcelain/client/walkthroughs/rules';
import { Button } from '@/components/ui/button';
import {
  NoChanges,
  type ComparedBranch,
  type DocumentProps,
} from '@/features/workspace/index';
import { useBranchChanges, useChanges } from '@/features/changes/index';
import { cn } from '@/shared/lib/utils';
import { StateFailure, StateSpinner } from '@/shared/views/state-notice';
import { useHeldWhileHidden } from '@/shared/hooks/use-held-while-hidden';
import { useStartWalkthrough } from '../commands/start-walkthrough';
import { useWalkthrough } from '../queries/walkthrough';
import { RichText } from './rich-text';
import {
  WalkthroughConversation,
  EarlierComments,
  PostSaved,
} from './walkthrough-conversation';
import { WalkthroughStatus } from './walkthrough-status';
import { WalkthroughProof } from './walkthrough-evidence';
import { WalkthroughStart } from './walkthrough-start';
import { ReviewCode } from './walkthrough-code-document';

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
  return (
    <p className="whitespace-pre-line font-mono text-caption text-muted-foreground">
      {walkthroughMeta(run, content)}
      {walkthroughEvidenceNotice(run)
        ? `\n${walkthroughEvidenceNotice(run)}`
        : ''}
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

function useFolded<T extends { hidden: number }>(fold: (open: boolean) => T) {
  const [open, setOpen] = useState(false);
  const folded = fold(open);
  return {
    ...folded,
    more:
      folded.hidden > 0 ? (
        <FoldedLink hidden={folded.hidden} onClick={() => setOpen(true)} />
      ) : null,
  };
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

function Growth({ content }: { content: WalkthroughContent }) {
  const { shown, more } = useFolded((open) => foldedGrowth(content, open));
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
              {growthSign(item)}
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
      {more}
    </section>
  );
}

function NotSaid({ content }: { content: WalkthroughContent }) {
  const { explained, unclear, total, more } = useFolded((open) =>
    foldedNotSaid(content, open),
  );
  if (total === 0) return null;
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
      {more}
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
            <span>{attentionLabel(attention)}</span>
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
  code,
  branch,
  conversation,
}: {
  stop: WalkthroughStop;
  step: number;
  run: WalkthroughRun;
  props: DocumentProps;
  code: ReviewCodeFiles | undefined;
  branch: ComparedBranch | undefined;
  conversation: Conversation | undefined;
}) {
  return (
    <li
      id={stepId(step)}
      className="flex scroll-mt-6 flex-col gap-2.5 border-t pt-5"
    >
      <p className="whitespace-pre-line font-mono text-caption text-muted-foreground">
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
      {code && (
        <ReviewCode
          document={props}
          entry={`review:step-${step}`}
          code={code}
          branch={branch}
          label={`Step ${step}`}
        />
      )}
      {conversation?.({ kind: 'step', step })}
    </li>
  );
}

function Written({
  run,
  content,
  freshness,
  props,
  onUpdate,
  updateFailure,
  progressRun,
  requesting,
  reused,
  code,
}: {
  code: Code;
  run: WalkthroughRun;
  content: WalkthroughContent;
  freshness: Parameters<typeof WalkthroughStatus>[0]['freshness'];
  progressRun: WalkthroughRun;
  requesting: boolean;
  reused: boolean;
  props: DocumentProps;
  onUpdate: () => void;
  updateFailure:
    | { failure: WalkthroughFailure; writer: WalkthroughRun['writer'] }
    | undefined;
}) {
  const owner = { ...props, runId: run.id };
  const writeBlock = useWorkspaceWriteBlock(props.context);
  const conversation: Conversation = ({ kind, step }) => {
    const title = content.stops[step - 1]!.title;
    return (
      <WalkthroughConversation
        key={title}
        owner={owner}
        title={title}
        call={kind === 'call'}
      />
    );
  };
  const status = (
    <WalkthroughStatus
      run={progressRun}
      requesting={requesting}
      reused={reused}
      freshness={freshness}
      failure={updateFailure}
      onUpdate={onUpdate}
      writeBlock={writeBlock}
    />
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
          {status}
        </header>
        <ReviewCode
          document={props}
          entry="review:all"
          code={code.sections.outside}
          branch={code.branch}
          label="Every changed file"
        />
        <EarlierComments owner={owner} titles={[]} />
        <PostSaved owner={owner} />
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
        {status}
      </header>
      <Calls content={content} conversation={conversation} />
      {content.growth.length > 0 && <Growth content={content} />}
      <ol className="flex flex-col gap-10">
        {content.stops.map((stop, index) => (
          <Step
            key={index}
            stop={stop}
            step={index + 1}
            run={run}
            props={props}
            code={code.sections.steps[index]}
            branch={code.branch}
            conversation={conversation}
          />
        ))}
      </ol>
      <NotSaid content={content} />
      <EarlierComments
        owner={owner}
        titles={content.stops.map((stop) => stop.title)}
      />
      {hasCode(code.sections.outside, code.branch) && (
        <section
          aria-labelledby="review-not-covered"
          className="flex flex-col gap-2.5 border-t pt-5"
        >
          <h2
            id="review-not-covered"
            className="text-lg leading-6 font-semibold text-pretty"
          >
            Not covered by the steps
          </h2>
          <ReviewCode
            document={props}
            entry="review:not-covered"
            code={code.sections.outside}
            branch={code.branch}
            label="Not covered by the steps"
          />
        </section>
      )}
      <PostSaved owner={owner} />
    </Column>
  );
}

function Writing({
  run,
  children,
}: {
  run: WalkthroughRun;
  children: ReactNode;
}) {
  return (
    <Column>
      <header className="flex flex-col gap-3">
        <Meta run={run} />
        <WalkthroughStatus run={run} />
      </header>
      {children}
    </Column>
  );
}

function Failed({
  run,
  failure,
  waiting,
  onRetry,
  writeBlock,
  children,
}: {
  run: WalkthroughRun | undefined;
  failure: WalkthroughFailure;
  waiting: boolean;
  onRetry: () => void;
  writeBlock: string | undefined;
  children: ReactNode;
}) {
  const copy = failureCopy(failure, run);
  return (
    <Column>
      <header className="flex flex-col items-start gap-3">
        <h1 className="text-subpage-title font-semibold tracking-tight">
          {copy.title}
        </h1>
        {run && <WalkthroughStatus run={run} requesting={waiting} />}
        {copy.message && (
          <p className="text-prose text-foreground-2">{copy.message}</p>
        )}
        <Button
          disabled={waiting || Boolean(writeBlock)}
          aria-description={writeBlock}
          onClick={onRetry}
        >
          Try again
        </Button>
      </header>
      {children}
    </Column>
  );
}

type Code = {
  sections: ReturnType<typeof reviewCodeSections>;
  branch: ComparedBranch | undefined;
  settled: boolean;
};

const hasCode = (code: ReviewCodeFiles, branch: ComparedBranch | undefined) =>
  (branch !== undefined && code.branch.length > 0) || code.worktree.length > 0;

function useReviewCode(
  props: DocumentProps,
  content: WalkthroughContent | undefined,
): Code {
  const hidden = props.interaction.hidden === true;
  const changes = useHeldWhileHidden(
    useChanges(props.scope, props.context.connection),
    hidden,
  );
  const result = useHeldWhileHidden(
    useBranchChanges(props.scope, props.context.connection, props.base).result,
    hidden,
  );
  const branch = Option.getOrUndefined(AsyncResult.value(result));
  return {
    sections: reviewCodeSections({
      content: content?.outcome === 'nothing' ? undefined : content,
      branch: branch?.files ?? [],
      worktree: changes.changes,
    }),
    branch,
    settled: branch !== undefined,
  };
}

export function ReviewDocument(props: DocumentProps) {
  const writeBlock = useWorkspaceWriteBlock(props.context);
  const {
    result,
    phase: observedPhase,
    read,
    refresh,
  } = useWalkthrough(props.scope, props.context);
  const write = useStartWalkthrough(
    props.scope,
    props.context,
    props.base,
    observedPhase && observedPhase.kind !== 'unwritten'
      ? observedPhase.run
      : undefined,
  );
  const phase = read
    ? walkthroughPhase(acknowledgedWalkthrough(read, write.accepted))
    : observedPhase;
  const code = useReviewCode(
    props,
    phase?.kind === 'ready' ? phase.content : undefined,
  );
  const everyFile = (
    <ReviewCode
      document={props}
      entry="review:all"
      code={code.sections.outside}
      branch={code.branch}
      label="Every changed file"
    />
  );
  if (phase === undefined)
    return AsyncResult.isFailure(result) ? (
      <div data-review-scroll="" className="@container h-full overflow-auto">
        <Column>
          <StateFailure
            description="The walkthrough could not be read."
            onRetry={refresh}
          />
          {everyFile}
        </Column>
      </div>
    ) : (
      <StateSpinner label="Loading walkthrough" />
    );
  const body = () => {
    const startFailure = initialWriteFailure(phase, write.failure);
    if (startFailure)
      return (
        <Failed
          run={startFailure.run}
          failure={startFailure.failure}
          waiting={write.waiting}
          onRetry={write.start}
          writeBlock={writeBlock}
        >
          {everyFile}
        </Failed>
      );
    switch (phase.kind) {
      case 'unwritten':
        if (code.settled && !hasCode(code.sections.outside, code.branch))
          return <NoChanges {...props} />;
        return (
          <Column>
            <WalkthroughStart
              document={props}
              waiting={write.waiting}
              onWrite={write.start}
            />
            {everyFile}
          </Column>
        );
      case 'writing':
        return <Writing run={phase.run}>{everyFile}</Writing>;
      case 'failed':
        return (
          <Failed
            run={phase.run}
            failure={phase.failure}
            waiting={write.waiting}
            onRetry={write.start}
            writeBlock={writeBlock}
          >
            {everyFile}
          </Failed>
        );
      case 'ready': {
        const update = readyUpdate(phase, write);
        return (
          <Written
            key={phase.run.id}
            run={phase.run}
            content={phase.content}
            freshness={phase.freshness}
            props={props}
            onUpdate={write.start}
            progressRun={phase.attempt ?? phase.run}
            requesting={write.waiting}
            reused={
              write.accepted?.state.status === 'ready' &&
              write.accepted.id === phase.run.id
            }
            updateFailure={update.failure}
            code={code}
          />
        );
      }
    }
  };
  return (
    <div data-review-scroll="" className="@container h-full overflow-auto">
      {body()}
    </div>
  );
}
