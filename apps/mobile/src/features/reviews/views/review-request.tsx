import { useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { reviewCommands } from '@porcelain/client/reviews';
import {
  changeAnchor,
  reviewErrorMessage,
  type ReviewRevision,
} from '@porcelain/client/reviews/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { useCommentWrite } from '../commands/comments';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import { Box } from '../../../components/ui/box';

export function ReviewRequest({
  label,
  body,
  revision,
  connection,
  target,
}: {
  label: string;
  body: string;
  revision: ReviewRevision;
  connection: RuntimeConnection;
  target?: { kind: 'decision' | 'question'; id: string };
}) {
  const command = useCommentWrite(
    reviewCommands({ connection, reviewId: revision.reviewId }).requestFeedback,
  );
  const [ids] = useState(() => ({
    threadId: randomUUID(),
    messageId: randomUUID(),
  }));
  const [status, setStatus] = useState<string>();
  return (
    <Box gap={1}>
      <Button
        label={status ? `${label} · posted` : label}
        variant="plain"
        size="sm"
        disabled={command.result.waiting || status !== undefined}
        onPress={() =>
          command.send(
            {
              ...ids,
              body,
              reviewRevision: revision.revision,
              anchor: {
                ...changeAnchor({ base: revision.base, tip: revision.headOid }),
                ...(target === undefined ? {} : { reviewTarget: target }),
              },
            },
            (answer) => setStatus(answer.delivery),
          )
        }
      />
      {status ? (
        <Text variant="caption" tone="muted">
          {status}
        </Text>
      ) : null}
      {AsyncResult.isFailure(command.result) ? (
        <Text variant="caption" tone="destructive">
          {reviewErrorMessage(Cause.squash(command.result.cause))}
        </Text>
      ) : null}
    </Box>
  );
}
