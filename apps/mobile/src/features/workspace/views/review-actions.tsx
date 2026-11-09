import type { ReactNode } from 'react';
import { Box } from '../../../components/ui/box';
import type { DocumentAction } from '../../../components/ui/document-header';
import { useAtom } from '@effect/atom-react';
import {
  reviewedCommandFailure,
  reviewedCommands,
  reviewCommands,
} from '@porcelain/client/reviews';
import {
  reviewedControlLabel,
  unavailableReviewText,
  type ReviewRevision,
  type ReviewableItem,
} from '@porcelain/client/reviews/rules';
import { reviewErrorMessage } from '@porcelain/client/reviews/rules';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import type { Workspace } from '../../projects/index';
import {
  reviewRange,
  type ReviewFile,
  type ReviewSnapshot,
} from '../rules/comparison';

export function useReviewedAction(
  workspace: Workspace,
  snapshot: ReviewSnapshot,
  file: ReviewFile,
): { action: DocumentAction | undefined; notice: ReactNode } {
  const commands = reviewedCommands({
    connection: workspace.connection,
    scope: workspace.scope,
    range: reviewRange(snapshot),
  });
  const [mark, set] = useAtom(commands.set);
  const [unmark, remove] = useAtom(commands.remove);
  const pending = mark.waiting || unmark.waiting;
  const error = reviewedCommandFailure(mark, unmark);
  const { fingerprint } = file;
  return {
    action: fingerprint
      ? {
          kind: 'button',
          id: 'reviewed',
          label: reviewedButtonLabel(file.reviewStatus),
          icon:
            file.reviewStatus === 'reviewed'
              ? 'unmarkReviewed'
              : 'markReviewed',
          disabled: pending,
          onPress: () => {
            if (pending) return;
            if (file.reviewStatus === 'reviewed') remove(file.path);
            else set({ path: file.path, fingerprint });
          },
        }
      : undefined,
    notice:
      fingerprint && !error ? null : (
        <Box paddingX={4} paddingY={2} gap={2}>
          {fingerprint ? null : (
            <Text variant="caption" tone="muted">
              {unavailableReviewText([file.path])}
            </Text>
          )}
          {error ? (
            <Text
              variant="caption"
              tone="destructive"
              accessibilityRole="alert"
            >
              {reviewErrorMessage(error)}
            </Text>
          ) : null}
        </Box>
      ),
  };
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
          variant="tonal"
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
