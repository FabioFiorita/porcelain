import { Box } from '../../../components/ui/box';
import { useAtom } from '@effect/atom-react';
import {
  reviewedCommandFailure,
  reviewedCommands,
} from '@porcelain/client/reviews';
import {
  reviewedControlLabel,
  reviewErrorMessage,
} from '@porcelain/client/reviews/rules';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import type { Workspace } from '../../projects';
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
  workspace: Workspace;
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
  const error = reviewedCommandFailure(mark, unmark);
  return (
    <Box gap={2}>
      {file.fingerprint ? (
        <Button
          label={reviewedButtonLabel(file.reviewStatus)}
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

function reviewedButtonLabel(status: ReviewFile['reviewStatus']) {
  if (status === 'reviewed') return 'Unmark reviewed';
  if (status === 'stale') return 'Review again';
  return 'Mark reviewed';
}
