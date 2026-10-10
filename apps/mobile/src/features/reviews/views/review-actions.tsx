import { Box } from '../../../components/ui/box';
import { useAtom } from '@effect/atom-react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { reviewedCommands } from '@porcelain/client/reviews';
import {
  reviewedControlLabel,
  reviewErrorMessage,
} from '@porcelain/client/reviews/rules';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import type { ReviewWorkspace } from '../adapters/workspace';
import {
  reviewRange,
  type ReviewFile,
  type ReviewSnapshot,
} from '../rules/comparison';

export function ReviewedAction({
  workspace,
  snapshot,
  file,
}: {
  workspace: ReviewWorkspace;
  snapshot: ReviewSnapshot;
  file: ReviewFile;
}) {
  const commands = reviewedCommands({
    connection: workspace.connection,
    scope: workspace.scope,
    range: reviewRange(snapshot),
  });
  const [mark, set] = useAtom(commands.set);
  const [unmark, remove] = useAtom(commands.remove);
  const pending = mark.waiting || unmark.waiting;
  const error = (() => {
    if (AsyncResult.isFailure(mark)) {
      return Cause.squash(mark.cause);
    }
    if (AsyncResult.isFailure(unmark)) {
      return Cause.squash(unmark.cause);
    }
    return undefined;
  })();
  return (
    <Box gap={2}>
      {file.fingerprint ? (
        <Button
          label={(() => {
            if (file.reviewStatus === 'reviewed') {
              return 'Unmark reviewed';
            }
            if (file.reviewStatus === 'stale') {
              return 'Review again';
            }
            return 'Mark reviewed';
          })()}
          accessibilityLabel={reviewedControlLabel(
            file.path,
            file.reviewStatus,
          )}
          variant="outline"
          pending={pending}
          onPress={() => {
            if (pending || !file.fingerprint) return;
            if (file.reviewStatus === 'reviewed') remove(file.path);
            else set({ path: file.path, fingerprint: file.fingerprint });
          }}
        />
      ) : (
        <Text variant="caption" tone="muted">
          Not reviewable: the current file state could not be established.
        </Text>
      )}
      {error ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {reviewErrorMessage(error)}
        </Text>
      ) : null}
    </Box>
  );
}
