import type { ReactNode } from 'react';
import { Box } from '../../../components/ui/box';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { readPublishedReview } from '@porcelain/client/reviews';
import {
  notExplainedLabel,
  proofLabel,
  proofStatus,
} from '@porcelain/client/reviews/rules';
import { Text } from '../../../components/ui/text';
import { Item } from '../../../components/ui/item';
import { ReviewReadState } from './read-state';
import type { Workspace } from '../../projects';

export function PublishedReview({
  workspace,
  onFile,
  empty,
}: {
  workspace: Workspace;
  onFile: (path: string) => void;
  empty?: ReactNode;
}) {
  const query = readPublishedReview({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={refresh} />;
  const review = result.value;
  if (!review) return empty ?? null;
  return (
    <Box gap={3}>
      <Text variant="heading">
        {review.active ? 'Agent review' : 'Saved review'}
      </Text>
      {review.diagnostics === 'unavailable' ? (
        <Text variant="caption" tone="muted">
          Current code diagnostics are unavailable.
        </Text>
      ) : null}
      {review.layers.map((layer) => (
        <Box key={layer.id} gap={2}>
          <Text variant="ui" weight="medium">
            {layer.title}
          </Text>
          <Text variant="ui" selectable>
            {layer.summary}
          </Text>
          {layer.steps.map((step) => (
            <Item
              key={step.id}
              title={step.title}
              description={`${step.pointer.path} · ${step.location.state}`}
              disabled={step.location.state === 'broken'}
              onPress={() => {
                if (step.location.state !== 'broken') onFile(step.pointer.path);
              }}
            >
              <Text variant="caption" tone="muted">
                {step.text}
              </Text>
            </Item>
          ))}
        </Box>
      ))}
      {notExplainedLabel(review.notExplained) ? (
        <Text variant="caption" tone="muted">
          Not explained: {notExplainedLabel(review.notExplained)}
        </Text>
      ) : null}
      <Text variant="caption" tone="muted">
        Proof · {proofLabel(proofStatus(review.proof))}
      </Text>
    </Box>
  );
}
