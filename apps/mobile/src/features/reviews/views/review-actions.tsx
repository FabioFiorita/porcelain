import { Box } from '../../../components/ui/box';
import { useAtom } from '@effect/atom-react';
import {
  reviewedCommandFailure,
  reviewedCommands,
  reviewCommands,
} from '@porcelain/client/reviews';
import {
  reviewedControlLabel,
  unavailableReviewText,
  reviewErrorMessage,
  type ReviewRevision,
  type ReviewableItem,
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
    <ReviewToggle
      file={file}
      pending={pending}
      error={error}
      onPress={() => {
        if (!file.fingerprint) return;
        if (file.reviewStatus === 'reviewed') remove(file.path);
        else set({ path: file.path, fingerprint: file.fingerprint });
      }}
    />
  );
}

export function RevisionReviewedAction({
  workspace,
  revision,
  file,
}: {
  workspace: Workspace;
  revision: ReviewRevision;
  file: ReviewableItem;
}) {
  const commands = reviewCommands({
    connection: workspace.connection,
    reviewId: revision.reviewId,
  });
  const [mark, set] = useAtom(commands.mark);
  const [unmark, remove] = useAtom(commands.unmark);
  return (
    <ReviewToggle
      file={file}
      pending={mark.waiting || unmark.waiting}
      error={reviewedCommandFailure(mark, unmark)}
      onPress={() => {
        if (!file.fingerprint) return;
        if (file.reviewStatus === 'reviewed')
          remove({
            kind: 'file',
            path: file.path,
            headBlobOid: file.fingerprint,
          });
        else
          set({
            kind: 'file',
            revision: revision.revision,
            path: file.path,
            headBlobOid: file.fingerprint,
          });
      }}
    />
  );
}

function ReviewToggle({
  file,
  pending,
  error,
  onPress,
}: {
  file: Pick<ReviewFile, 'path' | 'fingerprint' | 'reviewStatus'>;
  pending: boolean;
  error: unknown;
  onPress: () => void;
}) {
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
            onPress();
          }}
        />
      ) : (
        <Text variant="caption" tone="muted">
          {unavailableReviewText([file.path])}
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
