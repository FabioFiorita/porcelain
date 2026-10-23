import { useState } from 'react';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { readReviewRevisionProof } from '@porcelain/client/reviews';
import { externalLink } from '@porcelain/client/links/rules';
import {
  systemChanges,
  verdictSections,
  type ReviewResponse,
  type ReviewRevision,
  type SystemPart,
  type WalkthroughKey,
} from '@porcelain/client/reviews/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Item } from '../../../components/ui/item';
import { ImageView } from '../../../components/ui/image-view';
import { ErrorState } from '../../../components/ui/error-state';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { ReviewReadState } from './read-state';
import { ProofChecks } from './proof-checks';

type Navigation = { go: (key: WalkthroughKey) => void };

export function ReviewBriefing({
  connection,
  review,
  revision,
  go,
}: {
  connection: RuntimeConnection;
  review: ReviewResponse;
  revision: ReviewRevision | undefined;
} & Navigation) {
  return revision ? (
    <BriefingVerdict
      connection={connection}
      revision={revision}
      review={review}
      go={go}
    />
  ) : (
    <Box gap={4}>
      <Text variant="ui" tone="muted">
        This saved review has no published verdict.
      </Text>
      <BriefingQuestions review={review} go={go} />
      <BriefingOwners review={review} go={go} />
      <ProofChecks checks={review.proof.checks} />
    </Box>
  );
}

export function BriefingVerdict({
  revision,
  connection,
  review,
  go,
}: {
  revision: ReviewRevision;
  connection: RuntimeConnection;
  review: ReviewResponse;
} & Navigation) {
  const sections = verdictSections(revision);
  const link = usePreviewLink();
  return (
    <Box gap={6}>
      {link.error ? <ErrorState message={link.error} /> : null}
      <Card
        variant={
          sections.recommendation.value === 'hold' ? 'warning' : 'success'
        }
        padding={4}
        gap={2}
      >
        <Box className="flex-row items-center justify-between" gap={2}>
          <Text variant="heading">{sections.recommendation.label}</Text>
          <Text variant="caption" tone="muted">
            Recommendation
          </Text>
        </Box>
        {sections.recommendation.reasons.map((reason, index) => (
          <Text key={index} variant="ui" selectable>
            • {reason}
          </Text>
        ))}
      </Card>
      <Box gap={2}>
        <Text variant="subheading" tone="muted">
          You asked
        </Text>
        <Text variant="ui" selectable>
          {sections.asked.text}
        </Text>
        {sections.asked.links.map((entry, index) =>
          externalLink(entry.url) ? (
            <Button
              key={`${index}:${entry.url}`}
              label={entry.title}
              accessibilityLabel={`Open brief: ${entry.title}`}
              variant="link"
              onPress={() => link.open(entry.url)}
            />
          ) : (
            <Text key={index} variant="ui">
              {entry.title}
            </Text>
          ),
        )}
      </Box>
      <BriefingQuestions review={review} go={go} />
      <Card padding={4} gap={3}>
        <Text variant="subheading">Proven at {sections.proven.shortHead}</Text>
        {!review.proof.current ? (
          <Text variant="ui">Checks ran before the latest changes.</Text>
        ) : null}
        {sections.proven.checks.length === 0 &&
        sections.proven.assets.length === 0 ? (
          <Text variant="ui" tone="muted">
            No proof was published.
          </Text>
        ) : null}
        <ProofChecks checks={sections.proven.checks} />
        {sections.proven.assets.map((asset) => (
          <ProofAsset
            key={asset.id}
            asset={asset}
            revision={revision}
            connection={connection}
          />
        ))}
      </Card>
      <BriefingOwners review={review} go={go} />
      {sections.removed.fileCount > 0 ? (
        <Card padding={4} gap={3}>
          <Text variant="subheading">
            Removed · {sections.removed.fileCount}{' '}
            {sections.removed.fileCount === 1 ? 'file' : 'files'}
          </Text>
          {sections.removed.groups
            .filter((entry) => entry.paths.length > 0)
            .map((entry, index) => (
              <Box key={index} gap={1}>
                <Text variant="ui" weight="medium">
                  {entry.behavior}
                </Text>
                <Text variant="ui" selectable>
                  {entry.why}
                </Text>
                {entry.paths.map((path) => (
                  <Text key={path} variant="code" tone="destructive" selectable>
                    {path}
                  </Text>
                ))}
              </Box>
            ))}
          {sections.removed.unexplainedPaths.map((path) => (
            <Text key={path} variant="code" tone="destructive" selectable>
              {path} · No removal explanation was published.
            </Text>
          ))}
        </Card>
      ) : null}
      <Box gap={2}>
        <Text variant="subheading" tone="muted">
          Not proven
        </Text>
        {sections.notProven.length === 0 ? (
          <Text variant="ui" tone="muted">
            No proof gaps were reported.
          </Text>
        ) : (
          sections.notProven.map((entry, index) => (
            <Box key={index} gap={1}>
              <Text variant="ui" weight="medium">
                {entry.what}
              </Text>
              <Text variant="ui" selectable>
                {entry.why}
              </Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

function BriefingQuestions({
  review,
  go,
}: { review: ReviewResponse } & Navigation) {
  return systemChanges(review).questions.map((part) => (
    <Card key={part.id} padding={4} gap={2}>
      <Text variant="subheading">Needs your decision</Text>
      <Text variant="ui" selectable>
        {part.problem}
      </Text>
      <PartRow part={part} label={part.label} go={go} review={review} />
    </Card>
  ));
}

function BriefingOwners({
  review,
  go,
}: { review: ReviewResponse } & Navigation) {
  const parts = systemChanges(review);
  if (parts.added.length + parts.changed.length + parts.removed.length === 0)
    return null;
  return (
    <Box gap={2}>
      <Text variant="subheading" tone="muted">
        What this adds to the system
      </Text>
      {(['added', 'changed', 'removed'] as const).flatMap((kind) =>
        parts[kind].map((part) => (
          <PartRow
            key={part.id}
            review={review}
            part={part}
            label={part.label}
            badge={
              { added: 'New', changed: 'Changed', removed: 'Removed' }[kind]
            }
            go={go}
          />
        )),
      )}
    </Box>
  );
}

function PartRow({
  part,
  label,
  badge,
  review,
  go,
}: {
  part: SystemPart;
  label: string;
  badge?: string;
  review: ReviewResponse;
} & Navigation) {
  const layer =
    part.decision === undefined ? undefined : review.layers[part.decision - 1];
  return (
    <Item
      title={label}
      titleNumberOfLines={2}
      {...(part.detail ? { description: part.detail } : {})}
      leading={badge ? <Badge label={badge} variant="outline" /> : undefined}
      trailing={
        part.decision ? (
          <Text variant="caption" tone="muted">
            {part.decision}
          </Text>
        ) : undefined
      }
      {...(layer
        ? {
            accessibilityLabel: `Open decision ${part.decision}: ${label}`,
            onPress: () => go(`decision:${layer.id}`),
          }
        : {})}
    />
  );
}

function ProofAsset({
  asset,
  revision,
  connection,
}: {
  asset: ReviewResponse['proof']['assets'][number];
  revision: ReviewRevision;
  connection: RuntimeConnection;
}) {
  const [expanded, setExpanded] = useState(false);
  const link = usePreviewLink();
  const decision = revision.content.layers.findIndex(
    (layer) => layer.id === asset.layerId,
  );
  const target = decision < 0 ? '' : ` · Decision ${decision + 1}`;
  const url =
    asset.kind === 'link' ? asset.url : revision.content.links?.revision.web;
  let onPress: (() => void) | undefined;
  let action = 'Open proof';
  if (asset.kind === 'image') {
    onPress = () => setExpanded(!expanded);
    action = expanded ? 'Hide image' : 'View image';
  } else if (url && externalLink(url)) {
    onPress = () => link.open(url);
  }
  const description = {
    image: 'Image',
    video: 'Video · opens in browser',
    link: 'Link',
  }[asset.kind];
  return (
    <Box gap={2}>
      {link.error ? <ErrorState message={link.error} /> : null}
      <Item
        title={asset.title}
        titleNumberOfLines={2}
        description={`${description}${target}`}
        accessibilityLabel={`${action}: ${asset.title}${target}`}
        {...(onPress ? { onPress } : {})}
      />
      {asset.kind === 'video' && !url ? (
        <Text variant="caption" tone="muted">
          Video playback is unavailable in this saved review.
        </Text>
      ) : null}
      {asset.kind === 'image' && expanded ? (
        <ProofImage
          revision={revision}
          connection={connection}
          id={asset.id}
          title={asset.title}
        />
      ) : null}
    </Box>
  );
}

function ProofImage({
  revision,
  connection,
  id,
  title,
}: {
  revision: ReviewRevision;
  connection: RuntimeConnection;
  id: string;
  title: string;
}) {
  const query = readReviewRevisionProof({
    connection,
    reviewId: revision.reviewId,
    revision: revision.revision,
    proofId: id,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={refresh} />;
  return (
    <Box className="h-64">
      <ImageView data={result.value.base64} label={title} />
    </Box>
  );
}
