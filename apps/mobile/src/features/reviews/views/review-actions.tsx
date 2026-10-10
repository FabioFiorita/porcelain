import { useAtom } from '@effect/atom-react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { reviewedCommands } from '@porcelain/client/reviews';
import {
  reviewedControlLabel,
  reviewErrorMessage,
} from '@porcelain/client/reviews/rules';
import { View } from 'react-native';
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
  const error = AsyncResult.isFailure(mark)
    ? Cause.squash(mark.cause)
    : AsyncResult.isFailure(unmark)
      ? Cause.squash(unmark.cause)
      : undefined;
  return (
    <View className="gap-2">
      {file.fingerprint ? (
        <Button
          label={
            file.reviewStatus === 'reviewed'
              ? 'Unmark reviewed'
              : file.reviewStatus === 'stale'
                ? 'Review again'
                : 'Mark reviewed'
          }
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
    </View>
  );
}
