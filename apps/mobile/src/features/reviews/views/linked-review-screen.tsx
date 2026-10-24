import { PullRequestState } from './pull-request-state';
import { useState } from 'react';
import { Stack, useLocalSearchParams, useIsFocused } from 'expo-router';
import { ScrollView, View } from 'react-native';
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
  stopTitle,
  stopDone,
  revisionReviewItems,
  revisionDecisionStates,
  type WalkthroughKey,
  type ReviewAppLink,
} from '@porcelain/client/reviews/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { readReviewMarks } from '@porcelain/client/reviews';
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
import { useReviewNavigation } from '../store';
import { BriefingVerdict } from './review-briefing';
import { BriefingContinue } from './briefing-continue';
import { briefingContinuation } from '../rules/briefing';
import { ReviewReadState } from './read-state';

type Revision = LinkedRevision;
type DecisionNavigation = {
  navigation: ReturnType<typeof useReviewNavigation>;
};

export function LinkedReviewScreen() {
  const navigation = useReviewNavigation();
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
          <Text variant="heading">Pair this computer to open the review</Text>
          <Text>
            This environment is not paired. Pair {destination.host}; your review
            and decision will stay here.
          </Text>
          {pairing ? (
            <PairEnvironmentForm
              environmentId={destination.environmentId}
              onClose={() => setPairing(false)}
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
  const [place, setPlace] = useState<WalkthroughKey>(
    destination.decision ? `decision:${destination.decision}` : 'briefing',
  );
  const stops = walkthroughStops(
    revision.content,
    revision.files.map((file) => file.path),
    { specsApart: true },
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
  const go = (key: WalkthroughKey) => setPlace(key);
  return (
    <Box className="flex-1">
      <Stack.Screen
        options={{ title: stop.kind === 'briefing' ? 'Briefing' : 'Review' }}
      />
      <ScrollView
        key={stop.key}
        ref={(view) => navigation.scroll(view)}
        onContentSizeChange={() => navigation.scrollToDecision()}
        removeClippedSubviews={false}
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View ref={(view) => navigation.content(view)} collapsable={false}>
          <Box
            className="w-full max-w-3xl self-center"
            gap={4}
            padding={4}
            paddingBottom={8}
          >
            <Text variant="caption" tone="muted">
              {revision.branch} · Revision {revision.revision}
            </Text>
            <PullRequestState
              connection={connection}
              reviewId={revision.reviewId}
            />
            {place !== stop.key ? (
              <ErrorState message="This decision is not in this revision." />
            ) : null}
            {stop.kind === 'briefing' ? (
              <>
                <Text
                  variant="heading"
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
                <Text variant="subheading" tone="muted">
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
                <Button
                  label="All decisions"
                  variant="outline"
                  onPress={() => go('briefing')}
                />
                {selected ? (
                  <Decision
                    key={selected.id}
                    layer={selected}
                    navigation={navigation}
                  />
                ) : (
                  <Box gap={2}>
                    <Text variant="heading">{stopTitle(stop)}</Text>
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
                                (range) =>
                                  `${range.startLine}–${range.endLine}`,
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
        </View>
      </ScrollView>
      {stop.kind === 'briefing' && next ? (
        <BriefingContinue label={next.label} onPress={() => go(next.key)} />
      ) : null}
    </Box>
  );
}

function Decision({
  layer,
  navigation,
}: { layer: Revision['content']['layers'][number] } & DecisionNavigation) {
  return (
    <View ref={(view) => navigation.decision(view)} collapsable={false}>
      <Box gap={4}>
        <Text variant="heading">{layer.title}</Text>
        <Text selectable>{layer.summary}</Text>
        {layer.steps.map((step, index) => (
          <Box key={step.id} gap={3}>
            <Text variant="subheading">
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
    </View>
  );
}

function excerptLanguage(path: string) {
  const language = sourceLanguage(path);
  return language ? { language } : {};
}
