import { useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  attentionLabel,
  failureCopy,
  foldedGrowth,
  foldedNotSaid,
  growthSign,
  plainText,
  readyUpdate,
  stopPaths,
  walkthroughCalls,
  walkthroughMeta,
  walkthroughEvidenceNotice,
  acknowledgedWalkthroughPhase,
  type walkthroughPhase,
  walkthroughVerdict,
  type WalkthroughContent,
  type WalkthroughFailure,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import type { KeyboardScroller } from '../../../components/ui/keyboard-reveal';
import { RichText } from '../../../components/ui/rich-text';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import type { Workspace } from '../../projects/index';
import { reviewParams } from '../../workspace/index';
import { useStartWalkthrough } from '../commands/start-walkthrough';
import type { ConversationOwner } from '../queries/conversations';
import { useWalkthroughOffset } from '../store';
import {
  EarlierComments,
  PostSaved,
  WalkthroughConversation,
  useSavedSummary,
} from './walkthrough-conversation';
import { WalkthroughStatus } from './walkthrough-status';
import { WalkthroughProof } from './walkthrough-evidence';

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

type Jump = (target: string) => void;
type Place = (target: string) => (y: number) => void;

function Column({
  workspace,
  bottom,
  children,
  onReady,
}: {
  workspace: Workspace;
  bottom?: boolean;
  children: (jump: Jump, place: Place, scroller: KeyboardScroller) => ReactNode;
  onReady?: ReactNode;
}) {
  const { initial, remember } = useWalkthroughOffset(workspace.key);
  const [scroll, setScroll] = useState<ComponentRef<typeof ScrollView> | null>(
    null,
  );
  const [places] = useState(() => new Map<string, number>());
  const jump: Jump = (target) => {
    const y = places.get(target);
    if (y !== undefined)
      scroll?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };
  const place: Place = (target) => (y) => {
    places.set(target, y);
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
        contentContainerClassName={[
          'w-full max-w-3xl self-center gap-8 px-4 pt-5',
          bottom ? 'pb-28' : 'pb-10',
        ].join(' ')}
      >
        {children(jump, place, scroll)}
      </ScrollView>
      {onReady}
    </Box>
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
    <Text variant="mono" tone="muted">
      {walkthroughMeta(run, content)}
      {walkthroughEvidenceNotice(run)
        ? `\n${walkthroughEvidenceNotice(run)}`
        : ''}
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

function Folded<T extends { hidden: number }>({
  fold,
  children,
}: {
  fold: (open: boolean) => T;
  children: (folded: T) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const folded = fold(open);
  return (
    <>
      {children(folded)}
      {folded.hidden > 0 ? (
        <MoreButton hidden={folded.hidden} onPress={() => setOpen(true)} />
      ) : null}
    </>
  );
}

function MoreButton({
  hidden,
  onPress,
}: {
  hidden: number;
  onPress: () => void;
}) {
  return (
    <Button
      label={`${hidden} more`}
      variant="plain"
      size="sm"
      align="start"
      className="-ml-3.5 self-start"
      onPress={onPress}
    />
  );
}

function Growth({ content }: { content: WalkthroughContent }) {
  return (
    <Box gap={2}>
      <SectionTitle>How the system grew</SectionTitle>
      <Folded fold={(open) => foldedGrowth(content, open)}>
        {({ shown }) =>
          shown.map((item, index) => (
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
                  <RichText
                    text={item.what}
                    variant="secondary"
                    weight="medium"
                  />
                  <Text variant="secondary" weight="medium">
                    .
                  </Text>{' '}
                  <RichText text={item.note} variant="secondary" tone="muted" />
                </Text>
              </Box>
            </Box>
          ))
        }
      </Folded>
    </Box>
  );
}

function NotSaid({ content }: { content: WalkthroughContent }) {
  if (content.onlyInTranscript.length + content.stillUnclear.length === 0)
    return null;
  return (
    <Box gap={3}>
      <Separator />
      <SectionTitle>{"What the code doesn't say"}</SectionTitle>
      <Folded fold={(open) => foldedNotSaid(content, open)}>
        {({ explained, unclear }) => (
          <>
            {explained.map((item, index) => (
              <Text key={`${index}:${item.point}`} variant="secondary">
                <RichText text={item.point} variant="secondary" />{' '}
                <RichText text={item.answer} variant="secondary" tone="muted" />
              </Text>
            ))}
            {unclear.map((item, index) => (
              <RichText
                key={`${index}:${item}`}
                text={item}
                variant="secondary"
                tone="muted"
              />
            ))}
          </>
        )}
      </Folded>
    </Box>
  );
}

function Calls({
  content,
  owner,
  jump,
  scroller,
}: {
  content: WalkthroughContent;
  owner: ConversationOwner;
  jump: Jump;
  scroller: KeyboardScroller;
}) {
  return walkthroughCalls(content).map(({ attention, step, stop }) => (
    <Card key={step} gap={3} padding={4}>
      <Box className="flex-row items-center justify-between" gap={3}>
        <Text variant="caption" tone="muted">
          {attentionLabel(attention)}
        </Text>
        <Button
          label={`Step ${step}`}
          variant="plain"
          size="sm"
          accessibilityLabel={`Go to step ${step}`}
          className="-my-1.5 -mr-3.5"
          onPress={() => jump(`step:${step}`)}
        />
      </Box>
      <RichText text={attention.question} variant="headline" />
      <RichText text={attention.note} variant="secondary" tone="muted" />
      <WalkthroughConversation
        owner={owner}
        title={stop.title}
        placement="call"
        scroller={scroller}
      />
    </Card>
  ));
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
}) {
  const router = useRouter();
  const owner = { workspace, runId: run.id };
  const saved = useSavedSummary(owner) !== undefined;
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
      <Meta run={run} content={content} />
      <Headline content={content} />
      <RichText text={content.summary} />
      <WalkthroughStatus
        run={progressRun}
        requesting={requesting}
        reused={reused}
        freshness={freshness}
        failure={updateFailure}
        onUpdate={onUpdate}
      />
    </Box>
  );
  if (content.outcome === 'nothing')
    return (
      <Column
        workspace={workspace}
        bottom={saved}
        onReady={<PostSaved owner={owner} />}
      >
        {() => (
          <>
            <Box gap={3}>
              {header}
              <Button
                label="See the change"
                variant="plain"
                size="sm"
                align="start"
                className="-ml-3.5 self-start"
                onPress={seeChange}
              />
            </Box>
            <EarlierComments owner={owner} titles={[]} />
          </>
        )}
      </Column>
    );
  return (
    <Column
      workspace={workspace}
      bottom={saved}
      onReady={<PostSaved owner={owner} />}
    >
      {(jump, place, scroller) => (
        <>
          {header}
          {walkthroughCalls(content).length > 0 ? (
            <Box
              gap={3}
              onLayout={(event) => place('calls')(event.nativeEvent.layout.y)}
            >
              <Calls
                content={content}
                owner={owner}
                jump={jump}
                scroller={scroller}
              />
            </Box>
          ) : null}
          {content.growth.length > 0 ? <Growth content={content} /> : null}
          {content.stops.map((stop, index) => {
            const step = index + 1;
            return (
              <Box
                key={`${index}:${stop.title}`}
                gap={3}
                onLayout={(event) =>
                  place(`step:${step}`)(event.nativeEvent.layout.y)
                }
              >
                <Separator />
                <Box className="flex-row items-center" gap={2}>
                  <Text variant="mono" tone="muted">
                    Step {step}
                  </Text>
                  {stop.attention ? (
                    <Button
                      label="Your call"
                      variant="plain"
                      size="sm"
                      accessibilityLabel={`Your call, step ${step}`}
                      className="-my-1.5 -ml-1.5"
                      onPress={() => jump('calls')}
                    />
                  ) : null}
                </Box>
                <RichText text={stop.title} variant="headline" />
                <RichText text={stop.explanation} />
                {stop.evidence.length > 0 ? (
                  <WalkthroughProof
                    workspace={workspace}
                    run={run}
                    step={step}
                    items={stop.evidence}
                  />
                ) : null}
                <WalkthroughConversation
                  owner={owner}
                  title={stop.title}
                  placement="step"
                  scroller={scroller}
                  lead={
                    stopPaths(stop).length > 0 ? (
                      <Button
                        label="See the code"
                        variant="plain"
                        size="sm"
                        accessibilityLabel={`See the code for step ${step}`}
                        onPress={() =>
                          router.push({
                            pathname: '/walkthrough-step',
                            params: {
                              workspace: workspace.key,
                              step: String(step),
                            },
                          })
                        }
                      />
                    ) : null
                  }
                />
              </Box>
            );
          })}
          <NotSaid content={content} />
          <EarlierComments
            owner={owner}
            titles={content.stops.map((stop) => stop.title)}
          />
          <Box gap={2}>
            <Separator />
            <Button
              label="See every changed file"
              variant="plain"
              size="sm"
              align="start"
              className="-ml-3.5 self-start"
              onPress={seeChange}
            />
          </Box>
        </>
      )}
    </Column>
  );
}

function Unwritten({
  workspace,
  waiting,
  onWrite,
}: {
  workspace: Workspace;
  waiting: boolean;
  onWrite: () => void;
}) {
  return (
    <Column workspace={workspace}>
      {() => (
        <Box gap={3} className="items-start">
          <Text variant="largeTitle" weight="semibold">
            No walkthrough yet.
          </Text>
          <Text tone="muted">
            A fresh agent reads this change and explains it. It never edits the
            code.
          </Text>
          <Button
            label="Write walkthrough"
            pending={waiting}
            onPress={onWrite}
          />
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
}: {
  workspace: Workspace;
  run: WalkthroughRun | undefined;
  failure: WalkthroughFailure;
  waiting: boolean;
  onRetry: () => void;
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
          <Button label="Try again" pending={waiting} onPress={onRetry} />
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
  const write = useStartWalkthrough(
    workspace,
    observedPhase.kind !== 'unwritten' ? observedPhase.run : undefined,
  );
  const phase = acknowledgedWalkthroughPhase(observedPhase, write.accepted);
  const startFailure =
    write.failure && (phase.kind === 'unwritten' || phase.kind === 'failed')
      ? write.failure
      : undefined;
  if (startFailure)
    return (
      <Failed
        workspace={workspace}
        run={phase.kind === 'failed' ? phase.run : undefined}
        failure={startFailure}
        waiting={write.waiting}
        onRetry={write.start}
      />
    );
  switch (phase.kind) {
    case 'unwritten':
      return (
        <Unwritten
          workspace={workspace}
          waiting={write.waiting}
          onWrite={write.start}
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
        />
      );
    }
  }
}
