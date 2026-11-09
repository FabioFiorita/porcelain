import {
  Stack,
  useNavigation,
  useRouter,
  type NativeStackNavigationProp,
} from 'expo-router';
import { ScrollView } from 'react-native';
import {
  neighbourStop,
  notExplainedLabel,
  stopTitle,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { Screen } from '../../../components/ui/screen';
import { Text } from '../../../components/ui/text';
import { WorkspaceGate } from '../../projects/index';
import { ListDetail } from '../../../components/ui/list-detail';
import { WalkthroughColumn } from './walkthrough-stop-list';
import { stopScreenTitle } from '../rules/briefing';
import { DecisionBar } from './decision-bar';
import { DecisionPage, RevisionDiffs } from './decision-page';
import {
  PublishedWalkthrough,
  type PublishedWalkthroughState,
} from './published-walkthrough';
import { ReviewPointer } from './review-pointer';
import { useStopCompletion } from './walkthrough-completion';
import { useWalkthroughRoutes } from './walkthrough-routes';

type Stop = Exclude<WalkthroughStop, { kind: 'briefing' }>;
export type StopParams = { stop: string };

export function DecisionScreen({
  workspace,
  stop,
}: {
  workspace?: string | undefined;
  stop?: string | undefined;
}) {
  return (
    <WorkspaceGate title="Decision" expectedWorkspace={workspace}>
      {(selected) => (
        <Screen layout="fixed">
          <PublishedWalkthrough workspace={selected}>
            {(walkthrough) => (
              <StopReader walkthrough={walkthrough} stopKey={stop} />
            )}
          </PublishedWalkthrough>
        </Screen>
      )}
    </WorkspaceGate>
  );
}

function StopReader({
  walkthrough,
  stopKey,
}: {
  walkthrough: PublishedWalkthroughState;
  stopKey: string | undefined;
}) {
  const router = useRouter();
  const navigation =
    useNavigation<NativeStackNavigationProp<Record<string, StopParams>>>();
  const stop = walkthrough.stops.find(
    (entry): entry is Stop =>
      entry.key === stopKey && entry.kind !== 'briefing',
  );
  if (!stop) return <MissingStop what="decision" />;
  const go = (key: WalkthroughKey) => {
    if (key === 'briefing') router.back();
    else navigation.setParams({ stop: key });
  };
  return (
    <>
      <Stack.Screen
        options={{ title: stopScreenTitle(stop, walkthrough.stops) }}
      />
      <ListDetail
        collapse="detail"
        list={() => (
          <WalkthroughColumn
            title={walkthrough.review.verdict?.asked.text ?? 'Agent review'}
            review={walkthrough.review}
            stops={walkthrough.stops}
            done={walkthrough.progress.done}
            current={stop.key}
            onStop={go}
          />
        )}
        detail={
          <>
            <ScrollView
              key={`${stop.key}:page`}
              className="flex-1"
              contentInsetAdjustmentBehavior="automatic"
              contentContainerClassName="w-full max-w-3xl self-center gap-4 p-4 pb-8"
            >
              <StopPage walkthrough={walkthrough} stop={stop} go={go} />
            </ScrollView>
            <StopBar
              key={`${stop.key}:bar`}
              walkthrough={walkthrough}
              stop={stop}
              go={go}
            />
          </>
        }
      />
    </>
  );
}

function StopPage({
  walkthrough,
  stop,
  go,
}: {
  walkthrough: PublishedWalkthroughState;
  stop: Stop;
  go: (key: WalkthroughKey) => void;
}) {
  const routes = useWalkthroughRoutes(walkthrough.workspace);
  const { workspace, review, revision, progress, changedPaths } = walkthrough;
  if (stop.kind === 'decision')
    return (
      <DecisionPage
        workspace={workspace}
        review={review}
        revision={revision}
        stop={stop}
        progress={progress}
        unavailable={walkthrough.unavailable}
        go={go}
        routes={routes}
        changedPaths={changedPaths}
      />
    );
  return (
    <>
      <Text variant="title" accessibilityRole="header">
        {stopTitle(stop)}
        {progress.done(stop) ? ' · Reviewed' : ''}
      </Text>
      <Text variant="secondary">
        {stop.kind === 'unexplained'
          ? (notExplainedLabel(review.notExplained) ??
            'These changed files have no agent explanation.')
          : 'Spec files set apart from the decisions.'}
      </Text>
      {(stop.kind === 'unexplained' ? review.notExplained : []).map((gap) => (
        <Text key={gap.path} variant="caption">
          {gap.path} ·{' '}
          {gap.binary
            ? 'Binary file'
            : gap.ranges
                .map((range) => `${range.startLine}–${range.endLine}`)
                .join(', ')}
        </Text>
      ))}
      <RevisionDiffs
        workspace={workspace}
        revision={revision}
        stop={stop}
        progress={progress}
        changedPaths={changedPaths}
        routes={routes}
      />
    </>
  );
}

function StopBar({
  walkthrough,
  stop,
  go,
}: {
  walkthrough: PublishedWalkthroughState;
  stop: Stop;
  go: (key: WalkthroughKey) => void;
}) {
  const routes = useWalkthroughRoutes(walkthrough.workspace);
  const next = neighbourStop(walkthrough.stops, stop.key, 1);
  const completion = useStopCompletion({
    workspace: walkthrough.workspace,
    stop,
    progress: walkthrough.progress,
    next,
    go,
    unavailable: walkthrough.unavailable,
  });
  return (
    <DecisionBar
      stop={stop}
      previous={neighbourStop(walkthrough.stops, stop.key, -1)}
      next={next}
      go={go}
      completion={completion}
      onComment={() =>
        routes.compose(
          walkthrough.review,
          stop.kind === 'decision' ? `On decision ${stop.number}: ` : '',
        )
      }
    />
  );
}

export function DecisionStepScreen({
  workspace,
  stop,
  step,
}: {
  workspace?: string | undefined;
  stop?: string | undefined;
  step?: string | undefined;
}) {
  return (
    <WorkspaceGate title="Step" expectedWorkspace={workspace}>
      {(selected) => (
        <Screen layout="fixed">
          <PublishedWalkthrough workspace={selected}>
            {(walkthrough) => (
              <StepReader
                walkthrough={walkthrough}
                stopKey={stop}
                stepId={step}
              />
            )}
          </PublishedWalkthrough>
        </Screen>
      )}
    </WorkspaceGate>
  );
}

function StepReader({
  walkthrough,
  stopKey,
  stepId,
}: {
  walkthrough: PublishedWalkthroughState;
  stopKey: string | undefined;
  stepId: string | undefined;
}) {
  const routes = useWalkthroughRoutes(walkthrough.workspace);
  const stop = walkthrough.stops.find((entry) => entry.key === stopKey);
  const steps = stop?.kind === 'decision' ? stop.layer.steps : [];
  const index = steps.findIndex((entry) => entry.id === stepId);
  const pointer = steps[index];
  if (!stop || !pointer) return <MissingStop what="step" />;
  return (
    <>
      <Stack.Screen
        options={{ title: `Step ${index + 1} of ${steps.length}` }}
      />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="w-full max-w-3xl self-center gap-3 p-4 pb-8"
      >
        <Text variant="headline" accessibilityRole="header" selectable>
          {pointer.title}
        </Text>
        <Text variant="secondary" selectable>
          {pointer.text}
        </Text>
        <ReviewPointer
          key={pointer.id}
          workspace={walkthrough.workspace}
          step={pointer}
        />
        {pointer.kind === 'changed' &&
        walkthrough.changedPaths.includes(pointer.pointer.path) ? (
          <Button
            label="Open changed-file diff"
            variant="tonal"
            onPress={() => routes.openChangedFile(pointer.pointer.path)}
          />
        ) : null}
        <Box className="flex-row flex-wrap" gap={2}>
          <Button
            label="Open in Files"
            variant="plain"
            size="sm"
            accessibilityLabel={`Open ${pointer.pointer.path} in Files`}
            onPress={() => routes.openInFiles(pointer.pointer.path)}
          />
          <Button
            label="File history"
            variant="plain"
            size="sm"
            accessibilityLabel={`History of ${pointer.pointer.path}`}
            onPress={() => routes.openFileHistory(pointer.pointer.path)}
          />
        </Box>
      </ScrollView>
    </>
  );
}

function MissingStop({ what }: { what: 'decision' | 'step' }) {
  const router = useRouter();
  return (
    <Empty
      title={
        what === 'decision'
          ? 'This decision is not in this revision'
          : 'This step is not in this revision'
      }
      description="The agent published a new revision. Return to the review to read it."
      action={{
        label: what === 'decision' ? 'Back to review' : 'Back to decision',
        onPress: () => router.back(),
      }}
    />
  );
}
