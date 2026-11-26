import { useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { commentsAt } from '@porcelain/client/comments/rules';
import {
  attentionLabel,
  failureCopy,
  foldedGrowth,
  growthSign,
  plainText,
  readyUpdate,
  initialWriteFailure,
  stopPaths,
  walkthroughMeta,
  type MetaFiles,
  walkthroughEvidenceNotice,
  acknowledgedWalkthroughPhase,
  type walkthroughPhase,
  walkthroughVerdict,
  type WalkthroughContent,
  type WalkthroughFailure,
  type WalkthroughRun,
  type WalkthroughStop,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import type { KeyboardScroller } from '../../../components/ui/keyboard-reveal';
import { RichText } from '../../../components/ui/rich-text';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import { DraftComments, newCommentParams, useComments } from '../../comments';
import type { Workspace } from '../../projects/index';
import { reviewParams } from '../../workspace/index';
import { useStartWalkthrough } from '../commands/start-walkthrough';
import type { ConversationOwner } from '../queries/conversations';
import type { WalkthroughPull } from '@porcelain/client/walkthroughs';
import { useWalkthroughPull } from '../queries/pull';
import { useWalkthroughScope } from '../queries/walkthrough';
import {
  useWalkthroughWriter,
  type WalkthroughWriter,
} from '../queries/writer';
import { useWalkthroughOffset } from '../store';
import {
  EarlierComments,
  WalkthroughConversation,
} from './walkthrough-conversation';
import { WalkthroughStatus } from './walkthrough-status';
import { ComparisonTable, StepBlocks } from './walkthrough-blocks';
import {
  Briefing,
  callTarget,
  stepTarget,
  type Jump,
} from './walkthrough-briefing';
import { CallDecision } from './walkthrough-decision';
import { WalkthroughMerge } from './walkthrough-merge';
import { WalkthroughStanding } from './walkthrough-standing';
import {
  WalkthroughWriterRow,
  walkthroughWriterUnavailable,
} from './walkthrough-writer';
import { useWritesBlocked } from '../../access';

type Phase = ReturnType<typeof walkthroughPhase>;

type UpdateFailure = {
  failure: WalkthroughFailure;
  writer: WalkthroughRun['writer'];
};

const GROWTH_TONES = {
  added: 'add',
  removed: 'del',
  changed: 'muted',
} as const;

type Place = (target: string, parent?: string) => (y: number) => void;

function Column({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: (jump: Jump, place: Place, scroller: KeyboardScroller) => ReactNode;
}) {
  const { initial, remember } = useWalkthroughOffset(workspace.key);
  const [scroll, setScroll] = useState<ComponentRef<typeof ScrollView> | null>(
    null,
  );
  const [places] = useState(
    () => new Map<string, { y: number; parent: string | undefined }>(),
  );
  const jump: Jump = (target) => {
    const place = places.get(target);
    if (place === undefined) return;
    const y = place.y + (place.parent ? (places.get(place.parent)?.y ?? 0) : 0);
    scroll?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };
  const place: Place = (target, parent) => (y) => {
    places.set(target, { y, parent });
  };
  return (
    <Box className="flex-1" surface="background" collapsable={false}>
      <ScrollView
        ref={setScroll}
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentOffset={{ x: 0, y: initial }}
        scrollEventThrottle={100}
        onScroll={(event) => remember(event.nativeEvent.contentOffset.y)}
        contentContainerClassName="w-full max-w-3xl self-center gap-8 px-4 pt-5 pb-10"
      >
        {children(jump, place, scroll)}
      </ScrollView>
    </Box>
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
  writer?: WalkthroughWriter | undefined;
  files?: MetaFiles | null;
}) {
  const model = content
    ? (writer?.settings?.models.find(
        (entry) =>
          entry.provider === run.writer.provider &&
          entry.model === run.writer.model,
      )?.label ?? run.writer.model)
    : undefined;
  const notice = content ? undefined : walkthroughEvidenceNotice(run);
  return (
    <Text variant="mono" tone="muted">
      {walkthroughMeta(run, content, model, files)}
      {notice ? `\n${notice}` : ''}
    </Text>
  );
}

function Headline({ content }: { content: WalkthroughContent }) {
  return (
    <Text variant="largeTitle" weight="semibold" accessibilityRole="header">
      <Text variant="largeTitle" weight="semibold" tone="muted">
        {plainText(content.title).replace(/\.$/, '')}.
      </Text>{' '}
      {walkthroughVerdict(content)}
    </Text>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="secondary" weight="semibold" accessibilityRole="header">
      {children}
    </Text>
  );
}

function LinkButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Button
      label={label}
      variant="plain"
      size="sm"
      align="start"
      className="-ml-3.5 self-start"
      onPress={onPress}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
    />
  );
}

function Growth({ content }: { content: WalkthroughContent }) {
  const [open, setOpen] = useState(false);
  const { shown, hidden } = foldedGrowth(content, open);
  return (
    <Box gap={2}>
      <SectionTitle>How the system grew</SectionTitle>
      {shown.map((item, index) => (
        <Box key={`${index}:${item.what}`} className="flex-row" gap={2}>
          <Text
            variant="code"
            tone={GROWTH_TONES[item.change]}
            accessibilityLabel={item.change}
            className="w-3"
          >
            {growthSign(item)}
          </Text>
          <Box className="min-w-0 flex-1">
            <Text variant="secondary">
              <RichText text={item.what} variant="secondary" weight="medium" />
              <Text variant="secondary" weight="medium">
                .
              </Text>{' '}
              <RichText text={item.note} variant="secondary" tone="muted" />
            </Text>
          </Box>
        </Box>
      ))}
      {hidden > 0 ? (
        <LinkButton label={`${hidden} more`} onPress={() => setOpen(true)} />
      ) : null}
    </Box>
  );
}

function CallPanels({
  owner,
  stop,
  step,
  place,
}: {
  owner: ConversationOwner;
  stop: WalkthroughStop;
  step: number;
  place: Place;
}) {
  return stop.callouts.map(({ attention, comparison }, index) => (
    <Card
      key={index}
      variant="warning"
      gap={2}
      padding={4}
      accessibilityLabel={`Your call: ${attentionLabel(attention)}`}
      onLayout={(event) =>
        place(
          callTarget(step, index),
          stepTarget(step),
        )(event.nativeEvent.layout.y)
      }
    >
      <Text variant="caption" weight="medium" tone="warn">
        Your call · {attentionLabel(attention)}
      </Text>
      <RichText text={attention.question} variant="headline" />
      <RichText text={attention.note} variant="secondary" tone="muted" />
      {comparison ? <ComparisonTable comparison={comparison} /> : null}
      <CallDecision
        owner={owner}
        step={step}
        index={index}
        comparison={comparison}
      />
    </Card>
  ));
}

function StepDrafts({
  workspace,
  title,
}: {
  workspace: Workspace;
  title: string;
}) {
  const { view } = useComments(workspace);
  return (
    <DraftComments
      workspace={workspace}
      drafts={commentsAt(
        view,
        (anchor) => anchor.kind === 'step' && anchor.title === title,
      )}
    />
  );
}

function StepSection({
  owner,
  stop,
  step,
  pull,
  place,
  scroller,
}: {
  owner: ConversationOwner & { run: WalkthroughRun };
  stop: WalkthroughStop;
  step: number;
  pull: WalkthroughPull;
  place: Place;
  scroller: KeyboardScroller;
}) {
  const router = useRouter();
  const { workspace, run } = owner;
  const title = plainText(stop.title);
  return (
    <Box
      gap={3}
      onLayout={(event) => place(stepTarget(step))(event.nativeEvent.layout.y)}
    >
      <Separator />
      <Box className="flex-row" gap={2}>
        <Text
          variant="headline"
          tone="muted"
          accessibilityLabel={`Step ${step}`}
        >
          {step}
        </Text>
        <Box className="min-w-0 flex-1">
          <RichText text={stop.title} variant="headline" />
        </Box>
      </Box>
      <RichText text={stop.explanation} />
      <CallPanels owner={owner} stop={stop} step={step} place={place} />
      <StepBlocks
        workspace={workspace}
        run={run}
        step={step}
        title={title}
        blocks={stop.blocks}
        pull={pull}
      />
      <StepDrafts workspace={workspace} title={title} />
      <WalkthroughConversation
        owner={owner}
        title={stop.title}
        stepTitle={title}
        scroller={scroller}
        actions={
          <>
            {stopPaths(stop).length > 0 ? (
              <Button
                label="See the code"
                variant="plain"
                size="sm"
                accessibilityLabel={`See the code for step ${step}`}
                onPress={() =>
                  router.push({
                    pathname: '/walkthrough-step',
                    params: { workspace: workspace.key, step: String(step) },
                  })
                }
              />
            ) : null}
            <Button
              label="Comment"
              variant="plain"
              size="sm"
              accessibilityLabel={`Comment on step ${step}`}
              onPress={() =>
                router.push({
                  pathname: '/comment',
                  params: newCommentParams(workspace.key, {
                    kind: 'step',
                    title,
                  }),
                })
              }
            />
          </>
        }
      />
    </Box>
  );
}

function Written({
  workspace,
  run,
  content,
  freshness,
  progressRun,
  requesting,
  reused,
  updateFailure,
  onUpdate,
  writer,
  blocked,
}: {
  workspace: Workspace;
  run: WalkthroughRun;
  content: WalkthroughContent;
  freshness: Parameters<typeof WalkthroughStatus>[0]['freshness'];
  progressRun: WalkthroughRun;
  requesting: boolean;
  reused: boolean;
  updateFailure: UpdateFailure | undefined;
  onUpdate: () => void;
  writer: WalkthroughWriter;
  blocked: boolean;
}) {
  const router = useRouter();
  const owner = { workspace, run };
  const pull = useWalkthroughPull(workspace, run);
  const scope = useWalkthroughScope(workspace, content);
  const seeChange = () =>
    router.push({
      pathname: '/review-changes',
      params: {
        ...reviewParams(workspace.key, { kind: 'branch' }),
        walkthrough: 'true',
      },
    });
  const header = (
    <Box gap={3}>
      <Meta run={run} content={content} writer={writer} files={scope.files} />
      <Headline content={content} />
      <WalkthroughStanding
        workspace={workspace}
        run={run}
        content={content}
        pull={pull}
      />
      <RichText text={content.summary} />
      <WalkthroughStatus
        run={progressRun}
        requesting={requesting}
        reused={reused}
        freshness={freshness}
        failure={updateFailure}
        onUpdate={onUpdate}
        writeBlock={writer.status?.block}
        updateDisabled={blocked}
        writerNotice={
          <WalkthroughWriterRow
            workspace={workspace}
            writer={writer}
            existingMessage={updateFailure?.failure.message}
            signedOut={updateFailure?.failure.kind === 'signed_out'}
          />
        }
      />
    </Box>
  );
  return (
    <Column workspace={workspace}>
      {(jump, place, scroller) => (
        <>
          {header}
          <Briefing
            workspace={workspace}
            owner={owner}
            run={run}
            content={content}
            pull={pull}
            jump={jump}
            scope={content.outcome === 'nothing' ? undefined : scope}
            onUncovered={seeChange}
          />
          {content.outcome !== 'nothing' && content.growth.length > 0 ? (
            <Growth content={content} />
          ) : null}
          {content.outcome === 'nothing'
            ? null
            : content.stops.map((stop, index) => (
                <StepSection
                  key={`${index}:${stop.title}`}
                  owner={owner}
                  stop={stop}
                  step={index + 1}
                  pull={pull}
                  place={place}
                  scroller={scroller}
                />
              ))}
          <EarlierComments
            owner={owner}
            titles={
              content.outcome === 'nothing'
                ? []
                : content.stops.map((stop) => stop.title)
            }
          />
          <Box gap={2}>
            <Separator />
            <LinkButton
              label={
                content.outcome === 'nothing'
                  ? 'See the change'
                  : 'See every changed file'
              }
              onPress={seeChange}
            />
          </Box>
          <WalkthroughMerge
            workspace={workspace}
            run={run}
            content={content}
            pull={pull}
          />
        </>
      )}
    </Column>
  );
}

function Unwritten({
  workspace,
  waiting,
  onWrite,
  writer,
  blocked,
}: {
  workspace: Workspace;
  waiting: boolean;
  onWrite: () => void;
  writer: WalkthroughWriter;
  blocked: boolean;
}) {
  return (
    <Column workspace={workspace}>
      {() => (
        <Box gap={3} className="items-start">
          <Text variant="largeTitle" weight="semibold">
            No walkthrough yet.
          </Text>
          {!writer.status && !writer.failed && (
            <Text tone="muted">Checking the connected computer…</Text>
          )}
          <WalkthroughWriterRow workspace={workspace} writer={writer} primary />
          {walkthroughWriterUnavailable(writer) ? null : (
            <Button
              label="Write walkthrough"
              pending={waiting}
              disabled={!writer.status || blocked}
              onPress={onWrite}
            />
          )}
        </Box>
      )}
    </Column>
  );
}

function Writing({
  workspace,
  run,
}: {
  workspace: Workspace;
  run: WalkthroughRun;
}) {
  return (
    <Column workspace={workspace}>
      {() => (
        <Box gap={3}>
          <Meta run={run} />
          <WalkthroughStatus run={run} />
        </Box>
      )}
    </Column>
  );
}

function Failed({
  workspace,
  run,
  failure,
  waiting,
  onRetry,
  writer,
  blocked,
}: {
  workspace: Workspace;
  run: WalkthroughRun | undefined;
  failure: WalkthroughFailure;
  waiting: boolean;
  onRetry: () => void;
  writer: WalkthroughWriter;
  blocked: boolean;
}) {
  const copy = failureCopy(failure, run);
  return (
    <Column workspace={workspace}>
      {() => (
        <Box gap={3} className="items-start">
          {run && <WalkthroughStatus run={run} requesting={waiting} />}
          <Text variant="title" accessibilityRole="header">
            {copy.title}
          </Text>
          {copy.message ? <Text tone="muted">{copy.message}</Text> : null}
          <WalkthroughWriterRow
            workspace={workspace}
            writer={writer}
            existingMessage={copy.message}
            signedOut={failure.kind === 'signed_out'}
            primary={walkthroughWriterUnavailable(writer)}
          />
          {walkthroughWriterUnavailable(writer) ? null : (
            <Button
              label="Try again"
              pending={waiting}
              disabled={blocked}
              onPress={onRetry}
            />
          )}
        </Box>
      )}
    </Column>
  );
}

export function WalkthroughPage({
  workspace,
  phase: observedPhase,
}: {
  workspace: Workspace;
  phase: Phase;
}) {
  const writer = useWalkthroughWriter(workspace);
  const blocked = useWritesBlocked(workspace.connection.environmentId);
  const write = useStartWalkthrough(
    workspace,
    observedPhase.kind !== 'unwritten' ? observedPhase.run : undefined,
    writer.next,
  );
  const phase = acknowledgedWalkthroughPhase(observedPhase, write.accepted);
  const startFailure = initialWriteFailure(phase, write.failure);
  if (startFailure)
    return (
      <Failed
        workspace={workspace}
        run={startFailure.run}
        failure={startFailure.failure}
        waiting={write.waiting}
        onRetry={write.start}
        writer={writer}
        blocked={blocked}
      />
    );
  switch (phase.kind) {
    case 'unwritten':
      return (
        <Unwritten
          workspace={workspace}
          waiting={write.waiting}
          onWrite={write.start}
          writer={writer}
          blocked={blocked}
        />
      );
    case 'writing':
      return <Writing workspace={workspace} run={phase.run} />;
    case 'failed':
      return (
        <Failed
          workspace={workspace}
          run={phase.run}
          failure={phase.failure}
          waiting={write.waiting}
          onRetry={write.start}
          writer={writer}
          blocked={blocked}
        />
      );
    case 'ready': {
      const { failure } = readyUpdate(phase, write);
      return (
        <Written
          key={phase.run.id}
          workspace={workspace}
          run={phase.run}
          content={phase.content}
          freshness={phase.freshness}
          progressRun={phase.attempt ?? phase.run}
          requesting={write.waiting}
          reused={
            write.accepted?.state.status === 'ready' &&
            write.accepted.id === phase.run.id
          }
          updateFailure={failure}
          onUpdate={write.start}
          writer={writer}
          blocked={blocked}
        />
      );
    }
  }
}
