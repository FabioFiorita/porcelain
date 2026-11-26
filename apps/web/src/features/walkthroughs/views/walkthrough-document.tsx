import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { type ReactNode, useState } from 'react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  failureCopy,
  foldedGrowth,
  foldedNotSaid,
  growthSign,
  readyUpdate,
  initialWriteFailure,
  reviewCodeSections,
  eagerSections,
  walkthroughMeta,
  type MetaFiles,
  walkthroughEvidenceNotice,
  acknowledgedWalkthrough,
  walkthroughPhase,
  type ReviewCode as ReviewCodeFiles,
  type WalkthroughContent,
  type WalkthroughFailure,
  type WalkthroughRun,
  plainText,
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
import { useWalkthroughPull } from '../queries/pull';
import { RichText } from './rich-text';
import {
  WalkthroughConversation,
  EarlierComments,
} from './walkthrough-conversation';
import { WalkthroughStatus } from './walkthrough-status';
import { Briefing, scrollToTarget } from './walkthrough-briefing';
import { CommentsSummary } from '@/features/comments/index';
import {
  WalkthroughSteps,
  type Conversation,
  type Decision,
} from './walkthrough-steps';
import { CallDecision } from './walkthrough-decision';
import { WalkthroughStart } from './walkthrough-start';
import { useWalkthroughWriter } from '../queries/writer';
import { WalkthroughWriterRow } from './walkthrough-writer-notice';
import { WalkthroughMerge } from './walkthrough-merge';
import { WalkthroughStanding } from './walkthrough-standing';
import { ReviewCode } from './walkthrough-code-document';
import { DIFF_WINDOW_FILES } from '@/config/limits';

function Column({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-192 flex-col gap-10 px-5 py-8 @3xl:px-8 @3xl:py-12">
      {children}
    </div>
  );
}

function Meta({
  run,
  content,
  writer,
  files,
}: {
  run: WalkthroughRun;
  content?: WalkthroughContent;
  writer?: ReturnType<typeof useWalkthroughWriter> | undefined;
  files?: MetaFiles | null;
}) {
  const model =
    writer?.settings?.models.find(
      (entry) =>
        entry.provider === run.writer.provider &&
        entry.model === run.writer.model,
    )?.label ?? run.writer.model;
  return (
    <p className="whitespace-pre-line font-mono text-caption text-muted-foreground">
      {walkthroughMeta(run, content, content ? model : undefined, files)
        .split(' · ')
        .map((part, index) => (
          <span key={part}>
            {index > 0 && ' · '}
            <span className="whitespace-nowrap">{part}</span>
          </span>
        ))}
      {!content && walkthroughEvidenceNotice(run)
        ? `\n${walkthroughEvidenceNotice(run)}`
        : ''}
    </p>
  );
}

function Headline({ content }: { content: WalkthroughContent }) {
  return (
    <h1 className="text-subpage-title font-semibold tracking-tight text-balance">
      <RichText text={content.title.replace(/\.$/, '')} />
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
  const { explained, unclear, more } = useFolded((open) =>
    foldedNotSaid(content, open),
  );
  return (
    <>
      <ul className="flex flex-col gap-1 py-1 text-ui">
        {unclear.map((item, index) => (
          <li key={`${index}:${item}`}>
            <RichText text={item} />
          </li>
        ))}
        {explained.map((item, index) => (
          <li key={`${index}:${item.point}`}>
            <span className="font-medium">
              <RichText text={item.point} />
            </span>{' '}
            <span className="text-muted-foreground">
              <RichText text={item.answer} />
            </span>
          </li>
        ))}
      </ul>
      {more}
    </>
  );
}

function Written({
  run,
  content,
  freshness,
  props,
  onUpdate,
  writeBlock,
  writer,
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
  writeBlock: string | undefined;
  writer: ReturnType<typeof useWalkthroughWriter>;
  updateFailure:
    | { failure: WalkthroughFailure; writer: WalkthroughRun['writer'] }
    | undefined;
}) {
  const owner = { ...props, run };
  const pull = useWalkthroughPull(props, run);
  const notSaid =
    foldedNotSaid(content, false).total > 0 ? (
      <NotSaid content={content} />
    ) : undefined;
  const uncovered = [
    ...new Set([
      ...(code.branch ? code.sections.outside.branch : []),
      ...code.sections.outside.worktree,
    ]),
  ];
  const outsideCount = uncovered.length;
  const conversation: Conversation = ({ step }) => {
    const title = content.stops[step - 1]!.title;
    return (
      <WalkthroughConversation
        key={title}
        owner={owner}
        title={title}
        stepTitle={plainText(title)}
      />
    );
  };
  const decision: Decision = ({ step, index, comparison }) => (
    <CallDecision
      owner={owner}
      step={step}
      index={index}
      comparison={comparison}
    />
  );
  const status = (
    <WalkthroughStatus
      run={progressRun}
      requesting={requesting}
      reused={reused}
      freshness={freshness}
      failure={updateFailure}
      onUpdate={onUpdate}
      writeBlock={writeBlock}
      controls={(action) => (
        <WalkthroughWriterRow
          document={props}
          writer={writer}
          action={action}
          existingMessage={updateFailure?.failure.message}
          signedOut={updateFailure?.failure.kind === 'signed_out'}
        />
      )}
    />
  );
  const header = (
    <header className="flex flex-col gap-3">
      <Meta
        run={run}
        content={content}
        writer={writer}
        files={
          code.branch
            ? {
                committed: code.branch.files.map((file) => file.path),
                uncommitted: code.uncommitted,
              }
            : null
        }
      />
      <Headline content={content} />
      <WalkthroughStanding
        document={props}
        run={run}
        content={content}
        pull={pull}
      />
      <p className="text-prose text-foreground-2">
        <RichText text={content.summary} />
      </p>
      {status}
    </header>
  );
  if (content.outcome === 'nothing')
    return (
      <Column>
        {header}
        <Briefing
          run={run}
          content={content}
          owner={owner}
          pull={pull}
          notSaid={notSaid}
          onJump={scrollToTarget}
          comments={<CommentsSummary owner={props} />}
        />
        <ReviewCode
          document={props}
          entry="review:all"
          code={code.sections.outside}
          branch={code.branch}
          eager
          label="Every changed file"
        />
        <EarlierComments owner={owner} titles={[]} />
        <WalkthroughMerge document={props} run={run} content={content} />
      </Column>
    );
  return (
    <Column>
      {header}
      <Briefing
        run={run}
        content={content}
        owner={owner}
        pull={pull}
        notSaid={notSaid}
        onJump={scrollToTarget}
        comments={<CommentsSummary owner={props} />}
        scope={{ uncommitted: code.uncommitted, uncovered }}
      />
      {content.growth.length > 0 && <Growth content={content} />}
      <WalkthroughSteps
        content={content}
        run={run}
        props={props}
        code={code.sections.steps}
        branch={code.branch}
        eager={code.eager.steps}
        outside={outsideCount}
        conversation={conversation}
        decision={decision}
        pull={pull}
        onJump={scrollToTarget}
      />
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
            className="text-section font-semibold text-pretty"
          >
            Not covered by the steps
          </h2>
          <ReviewCode
            document={props}
            entry="review:not-covered"
            code={code.sections.outside}
            branch={code.branch}
            eager={code.eager.outside}
            label="Not covered by the steps"
          />
        </section>
      )}
      <WalkthroughMerge document={props} run={run} content={content} />
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
        <WalkthroughStatus run={run} first />
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
  document,
  writer,
  children,
}: {
  run: WalkthroughRun | undefined;
  failure: WalkthroughFailure;
  waiting: boolean;
  onRetry: () => void;
  writeBlock: string | undefined;
  document: DocumentProps;
  writer: ReturnType<typeof useWalkthroughWriter>;
  children: ReactNode;
}) {
  const copy = failureCopy(failure, run);
  return (
    <Column>
      <header className="flex flex-col items-start gap-3">
        <h1 className="text-subpage-title font-semibold tracking-tight">
          {copy.title}
        </h1>
        {run && <WalkthroughStatus run={run} requesting={waiting} first />}
        {copy.message && (
          <p className="text-prose text-foreground-2">{copy.message}</p>
        )}
        <WalkthroughWriterRow
          document={document}
          writer={writer}
          existingMessage={copy.message}
          signedOut={failure.kind === 'signed_out'}
          actionFirst
          action={{
            label: 'Try again',
            variant: 'default',
            disabled: waiting || Boolean(writeBlock),
            description: writeBlock,
            onClick: onRetry,
          }}
        />
      </header>
      {children}
    </Column>
  );
}

type Code = {
  sections: ReturnType<typeof reviewCodeSections>;
  eager: ReturnType<typeof eagerSections>;
  branch: ComparedBranch | undefined;
  uncommitted: readonly string[];
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
  const sections = reviewCodeSections({
    content: content?.outcome === 'nothing' ? undefined : content,
    branch: branch?.files ?? [],
    worktree: changes.changes,
  });
  return {
    sections,
    eager: eagerSections(sections, branch !== undefined, DIFF_WINDOW_FILES),
    branch,
    uncommitted: changes.changes.map((change) => change.path),
    settled: branch !== undefined,
  };
}

export function ReviewDocument(props: DocumentProps) {
  const writer = useWalkthroughWriter(props);
  const writeBlock =
    useWorkspaceWriteBlock(props.context) ?? writer.status?.block;
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
    writer.next,
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
      eager
      label="Every changed file"
    />
  );
  if (phase === undefined)
    return AsyncResult.isFailure(result) ? (
      <div data-review-scroll="" className="@container h-full overflow-auto">
        <Column>
          <StateFailure
            className="px-0"
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
          document={props}
          writer={writer}
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
              writer={writer}
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
            document={props}
            writer={writer}
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
            writeBlock={writeBlock}
            writer={writer}
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
