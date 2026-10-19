import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import {
  useAtomMount,
  useAtomRef,
  useAtomRefresh,
  useAtomValue,
} from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  parseReviewAppLink,
  type ReviewAppLink,
} from '@porcelain/client/reviews/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
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
import { ReviewReadState } from './read-state';

type Revision = LinkedRevision;

export function LinkedReviewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'reviewId' || value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value])
      query.append(key, entry);
  }
  const reviewId = typeof params.reviewId === 'string' ? params.reviewId : '';
  const destination = parseReviewAppLink(
    `/open/reviews/${encodeURIComponent(reviewId)}?${query}`,
  );
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Box
        className="w-full max-w-3xl self-center"
        gap={4}
        padding={4}
        paddingBottom={8}
      >
        <Button
          label="Back to Review"
          variant="ghost"
          onPress={() => router.replace('/review')}
        />
        {destination ? (
          <ReviewEnvironment
            key={JSON.stringify(destination)}
            destination={destination}
          />
        ) : (
          <ErrorState message="This review link is invalid. Ask the agent for a new link." />
        )}
      </Box>
    </ScrollView>
  );
}

function ReviewEnvironment({ destination }: { destination: ReviewAppLink }) {
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
    return (
      <ErrorState message={storage.error ?? 'Reading saved environments…'} />
    );
  if (!remote)
    return (
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
          <Button label="Pair this computer" onPress={() => setPairing(true)} />
        )}
      </Box>
    );
  if (!connection) return <Loading label="Connecting to review computer…" />;
  return (
    <SelectedReviewEnvironment
      key={destination.environmentId}
      destination={destination}
      connection={connection}
      name={remote.name}
      ready={selection.status === 'ready'}
    />
  );
}

function SelectedReviewEnvironment({
  destination,
  connection,
  name,
  ready,
}: {
  destination: ReviewAppLink;
  connection: RuntimeConnection;
  name: string;
  ready: boolean;
}) {
  return ready ? (
    <ReviewEnvironmentSelection
      destination={destination}
      connection={connection}
      name={name}
    />
  ) : (
    <Loading label="Reading saved selection…" />
  );
}

function ReviewEnvironmentSelection({
  destination,
  connection,
  name,
}: {
  destination: ReviewAppLink;
  connection: RuntimeConnection;
  name: string;
}) {
  const selection = useAtomValue(
    selectReviewEnvironment(destination.environmentId),
  );
  const refresh = useAtomRefresh(
    selectReviewEnvironment(destination.environmentId),
  );
  if (!AsyncResult.isSuccess(selection))
    return <ReviewReadState result={selection} refresh={refresh} />;
  return (
    <Box gap={4}>
      <Text variant="caption" tone="muted">
        Review on {name}
      </Text>
      <LinkedReview connection={connection} destination={destination} />
    </Box>
  );
}

function LinkedReview({
  connection,
  destination,
}: {
  connection: RuntimeConnection;
  destination: ReviewAppLink;
}) {
  const { result, refresh } = useLinkedReview({
    reviewId: destination.reviewId,
    connection,
    ...(destination.revision === undefined
      ? {}
      : { revision: destination.revision }),
  });
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
      revision={result.value.revision}
    />
  );
}

function LinkedReviewContent({
  connection,
  destination,
  revision,
}: {
  connection: RuntimeConnection;
  destination: ReviewAppLink;
  revision: Revision;
}) {
  useAtomMount(
    openReview({
      connection,
      reviewId: destination.reviewId,
      revision: revision.revision,
    }),
  );
  const [decision, setDecision] = useState(destination.decision);
  const selected = revision.content.layers.find(
    (layer) => layer.id === decision,
  );
  return (
    <Box gap={4}>
      <Text variant="heading">
        {revision.branch} · Revision {revision.revision}
      </Text>
      {decision && !selected ? (
        <ErrorState message="This decision is not in this revision." />
      ) : null}
      {decision ? (
        <Button
          label="All decisions"
          variant="outline"
          onPress={() => setDecision(undefined)}
        />
      ) : null}
      {selected ? (
        <Decision layer={selected} />
      ) : (
        <Box gap={3}>
          <Text variant="heading">Decisions</Text>
          {revision.content.layers.length === 0 ? (
            <Text>No decisions were published in this revision.</Text>
          ) : null}
          {revision.content.layers.map((layer, index) => (
            <Item
              key={layer.id}
              title={`${index + 1}. ${layer.title}`}
              description={layer.summary}
              accessibilityLabel={`Open decision ${index + 1}: ${layer.title}`}
              onPress={() => setDecision(layer.id)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

function Decision({ layer }: { layer: Revision['content']['layers'][number] }) {
  return (
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
            <DiffView
              lines={step.published.map((text, line) => ({
                id: String(line),
                text,
                newLine: step.pointer.startLine + line,
              }))}
              {...excerptLanguage(step.pointer.path)}
            />
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

function excerptLanguage(path: string) {
  const language = sourceLanguage(path);
  return language ? { language } : {};
}
