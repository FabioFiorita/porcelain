import { PullRequestState } from './pull-request-state';
import { useState } from 'react';
import {
  Stack,
  useIsFocused,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { ScrollView } from 'react-native';
import {
  useAtomMount,
  useAtomSet,
  useAtomRef,
  useAtomValue,
} from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  parseReviewAppLink,
  walkthroughStops,
  currentStop,
  neighbourStop,
  stopTitle,
  stopDone,
  revisionReviewItems,
  revisionDecisionStates,
  type WalkthroughKey,
  type ReviewAppLink,
} from '@porcelain/client/reviews/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { readReviewMarks } from '@porcelain/client/reviews';
import { specsApart } from '@porcelain/client/preferences/rules';
import { useReviewGitSettings } from '../../preferences';
import type { LinkedRevision } from '../queries/linked-review';
import {
  openReview,
  selectReviewEnvironment,
  useLinkedReview,
} from '../queries/linked-review';
import {
  remoteConnectionState,
  selectionState,
} from '../../../shared/application/store';
import { useEnvironments, useEnvironmentStorageStatus } from '../../access';
import { PairEnvironmentForm } from '../../access';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { ErrorState } from '../../../components/ui/error-state';
import { DiffView } from '../../../components/ui/diff-view';
import { sourceLanguage } from '../../../shared/rules/highlight-code';
import { BriefingVerdict } from './review-briefing';
import { BriefingContinue } from './briefing-continue';
import { briefingContinuation } from '../rules/briefing';
import { ReviewReadState } from './read-state';
import { AgentFeedback } from './agent-feedback';
import { ReviewBottomBar } from './review-bottom-bar';
import { IconButton } from '../../../components/ui/icon-button';

type Revision = LinkedRevision;
type StopNavigation = {
  place: string | undefined;
  open: (key: WalkthroughKey) => void;
  move: (key: WalkthroughKey) => void;
};
type DecisionNavigation = { navigation: StopNavigation };

export function LinkedReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const query = new URLSearchParams();
  for (const key of [
    'environment',
    'host',
    'protocol',
    'revision',
    'decision',
  ]) {
    const value = params[key];
    if (value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value])
      query.append(key, entry);
  }
  const reviewId = typeof params.reviewId === 'string' ? params.reviewId : '';
  const destination = parseReviewAppLink(
    `/open/reviews/${encodeURIComponent(reviewId)}?${query}`,
  );
  const link = Object.fromEntries(
    ['environment', 'host', 'protocol', 'revision'].flatMap((key) => {
      const value = params[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );
  const navigation: StopNavigation = {
    place: typeof params.stop === 'string' ? params.stop : undefined,
    open: (key) =>
      key === 'briefing'
        ? router.back()
        : router.push({
            pathname: '/reviews/[reviewId]',
            params: { ...link, reviewId, stop: key },
          }),
    move: (key) =>
      key === 'briefing' ? router.back() : router.setParams({ stop: key }),
  };
  return (
    <Box className="flex-1" surface="background">
      {destination ? (
        <ReviewEnvironment
          key={JSON.stringify(destination)}
          destination={destination}
          navigation={navigation}
        />
      ) : (
        <ErrorState message="This review link is invalid. Ask the agent for a new link." />
      )}
    </Box>
  );
}

function ReviewEnvironment({
  destination,
  navigation,
}: { destination: ReviewAppLink } & DecisionNavigation) {
  const remotes = useEnvironments();
  const storage = useEnvironmentStorageStatus();
  const connections = useAtomRef(remoteConnectionState);
  const [pairing, setPairing] = useState(false);
  const remote = remotes.find(
    (entry) => entry.environmentId === destination.environmentId,
  );
  const connection = connections.find(
    (entry) => entry.remote.environmentId === remote?.environmentId,
  )?.connection;
  const selection = useAtomRef(selectionState);
  if (storage.status !== 'ready')
    return <ErrorState message={storage.error ?? 'Reading saved computers…'} />;
  if (!remote)
    return (
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box gap={4}>
          <Text variant="title">Pair this computer to open the review</Text>
          <Text>
            This environment is not paired. Pair {destination.host}; your review
            and decision will stay here.
          </Text>
          {pairing ? (
            <PairEnvironmentForm
              environmentId={destination.environmentId}
              onClose={() => setPairing(false)}
              layout="inline"
            />
          ) : (
            <Button
              label="Pair this computer"
              onPress={() => setPairing(true)}
            />
          )}
        </Box>
      </ScrollView>
    );
  if (!connection) return <Loading label="Connecting to review computer…" />;
  return (
    <SelectedReviewEnvironment
      key={destination.environmentId}
      destination={destination}
      navigation={navigation}
      connection={connection}
      ready={selection.status === 'ready'}
      error={selection.error}
    />
  );
}

function SelectedReviewEnvironment({
  destination,
  navigation,
  connection,
  ready,
  error,
}: {
  destination: ReviewAppLink;
  connection: RuntimeConnection;
  ready: boolean;
  error: string | undefined;
} & DecisionNavigation) {
  if (error) return <ErrorState message={error} />;
  return ready ? (
    <ReviewEnvironmentSelection
      destination={destination}
      navigation={navigation}
      connection={connection}
    />
  ) : (
    <Loading label="Reading saved selection…" />
  );
}

function ReviewEnvironmentSelection({
  destination,
  navigation,
  connection,
}: {
  destination: ReviewAppLink;
  connection: RuntimeConnection;
} & DecisionNavigation) {
  const currentEnvironmentId = useAtomRef(selectionState).currentEnvironmentId;
  const focused = useIsFocused();
  const action = selectReviewEnvironment({
    environmentId: destination.environmentId,
    currentEnvironmentId,
    focused,
  });
  useAtomMount(action.start);
  const selection = useAtomValue(action.select);
  const run = useAtomSet(action.select);
  if (!AsyncResult.isSuccess(selection))
    return (
      <ReviewReadState result={selection} refresh={() => run(undefined)} />
    );
  return (
    <LinkedReview
      connection={connection}
      destination={destination}
      navigation={navigation}
    />
  );
}

function LinkedReview({
  connection,
  destination,
  navigation,
}: {
  connection: RuntimeConnection;
  destination: ReviewAppLink;
} & DecisionNavigation) {
  const { result, refresh, missing } = useLinkedReview({
    reviewId: destination.reviewId,
    connection,
    ...(destination.revision === undefined
      ? {}
      : { revision: destination.revision }),
  });
  if (missing)
    return (
      <ErrorState message="This review or revision could not be found. Ask the agent for a current link." />
    );
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={refresh} />;
  if (!result.value.revision)
    return (
      <ErrorState message="This review or revision could not be found. Ask the agent for a current link." />
    );
  return (
    <LinkedReviewContent
      key={`${result.value.revision.revision}:${destination.decision ?? ''}`}
      connection={connection}
      destination={destination}
      navigation={navigation}
      revision={result.value.revision}
    />
  );
}

function LinkedReviewContent({
  connection,
  destination,
  navigation,
  revision,
}: {
  connection: RuntimeConnection;
  destination: ReviewAppLink;
  revision: Revision;
} & DecisionNavigation) {
  const focused = useIsFocused();
  useAtomMount(
    openReview({
      connection,
      reviewId: destination.reviewId,
      revision: revision.revision,
      focused,
    }),
  );
  const place =
    navigation.place ??
    (destination.decision ? `decision:${destination.decision}` : 'briefing');
  const settings = useReviewGitSettings(connection);
  const stops = walkthroughStops(
    revision.content,
    revision.files.map((file) => file.path),
    { specsApart: specsApart(settings) },
  );
  const stop = currentStop(stops, place);
  const selected = stop.kind === 'decision' ? stop.layer : undefined;
  const marks = useAtomValue(
    readReviewMarks({ connection, reviewId: revision.reviewId }),
  );
  const settled = AsyncResult.isSuccess(marks) && !marks.waiting;
  const items = revisionReviewItems(
    revision,
    settled ? marks.value : undefined,
  );
  const states = revisionDecisionStates(
    revision,
    settled ? marks.value : undefined,
  );
  const done = (entry: (typeof stops)[number]) =>
    settled && stopDone(entry, items, states);
  const next = briefingContinuation(stops, done);
  const go = stop.kind === 'briefing' ? navigation.open : navigation.move;
  const previous = neighbourStop(stops, stop.key, -1);
  const following = neighbourStop(stops, stop.key, 1);
  return (
    <Box className="flex-1">
      <Stack.Screen options={{ title: linkedTitle(stop, stops) }} />
      <ScrollView
        key={stop.key}
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box
          className="w-full max-w-3xl self-center"
          gap={4}
          padding={4}
          paddingBottom={8}
        >
          <Text variant="caption" tone="muted">
            {revision.branch} · Revision {revision.revision}
          </Text>
          {stop.kind === 'briefing' ? (
            <>
              <AgentFeedback
                connection={connection}
                reviewId={revision.reviewId}
                reviewRevision={revision.revision}
                writable={false}
              />
              <PullRequestState
                connection={connection}
                reviewId={revision.reviewId}
              />
            </>
          ) : null}
          {place !== stop.key ? (
            <ErrorState message="This decision is not in this revision." />
          ) : null}
          {stop.kind === 'briefing' ? (
            <>
              <Text
                variant="title"
                numberOfLines={3}
                accessibilityLabel={revision.verdict.asked.text}
              >
                {revision.verdict.asked.text}
              </Text>
              <BriefingVerdict
                revision={revision}
                connection={connection}
                review={revision.content}
                go={go}
              />
              <Text variant="headline" tone="muted">
                The walkthrough
              </Text>
              {revision.content.layers.length === 0 ? (
                <Text>No decisions were published in this revision.</Text>
              ) : null}
              {stops.slice(1).map((entry) => (
                <Item
                  key={entry.key}
                  title={stopTitle(entry)}
                  description={
                    entry.kind === 'decision'
                      ? entry.layer.summary
                      : `${entry.paths.length} files`
                  }
                  accessibilityLabel={`Open ${stopTitle(entry)}`}
                  onPress={() => go(entry.key)}
                />
              ))}
            </>
          ) : (
            <>
              {selected ? (
                <Decision key={selected.id} layer={selected} />
              ) : (
                <Box gap={2}>
                  <Text variant="title">{stopTitle(stop)}</Text>
                  {stop.paths.map((path) => (
                    <Text key={path} variant="code" selectable>
                      {path}
                    </Text>
                  ))}
                  {stop.kind === 'unexplained'
                    ? stop.partial.map((gap) => (
                        <Text key={gap.path} variant="code" selectable>
                          {gap.path} ·{' '}
                          {gap.ranges
                            .map(
                              (range) => `${range.startLine}–${range.endLine}`,
                            )
                            .join(', ')}
                        </Text>
                      ))
                    : null}
                </Box>
              )}
            </>
          )}
        </Box>
      </ScrollView>
      {stop.kind === 'briefing' && next ? (
        <BriefingContinue label={next.label} onPress={() => go(next.key)} />
      ) : null}
      {stop.kind === 'briefing' ? null : (
        <ReviewBottomBar>
          <Box className="flex-row items-center" gap={2}>
            <IconButton
              icon="previous"
              accessibilityLabel={
                previous
                  ? `Previous stop: ${stopTitle(previous)}`
                  : 'Previous stop'
              }
              disabled={!previous}
              onPress={() => previous && go(previous.key)}
            />
            <Text
              variant="secondary"
              tone="muted"
              className="flex-1 text-center"
            >
              Read-only review
            </Text>
            <IconButton
              icon="chevron"
              accessibilityLabel={
                following ? `Next stop: ${stopTitle(following)}` : 'Next stop'
              }
              disabled={!following}
              onPress={() => following && go(following.key)}
            />
          </Box>
        </ReviewBottomBar>
      )}
    </Box>
  );
}

function Decision({ layer }: { layer: Revision['content']['layers'][number] }) {
  return (
    <Box gap={4}>
      <Text variant="title">{layer.title}</Text>
      <Text selectable>{layer.summary}</Text>
      {layer.steps.map((step, index) => (
        <Box key={step.id} gap={3}>
          <Text variant="headline">
            {index + 1}. {step.title}
          </Text>
          <Text selectable>{step.text}</Text>
          <Text variant="caption" tone="muted">
            {step.pointer.path} · Published excerpt
          </Text>
          {step.published?.length ? (
            <Box className="h-64">
              <DiffView
                lines={step.published.map((text, line) => ({
                  id: String(line),
                  text,
                  newLine: step.pointer.startLine + line,
                }))}
                {...excerptLanguage(step.pointer.path)}
              />
            </Box>
          ) : (
            <Text variant="caption">
              No excerpt was published for this step.
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

function linkedTitle(
  stop: ReturnType<typeof currentStop>,
  stops: ReturnType<typeof walkthroughStops>,
) {
  if (stop.kind === 'briefing') return 'Published review';
  if (stop.kind !== 'decision') return stopTitle(stop);
  return `Decision ${stop.number} of ${stops.filter((entry) => entry.kind === 'decision').length}`;
}

function excerptLanguage(path: string) {
  const language = sourceLanguage(path);
  return language ? { language } : {};
}
