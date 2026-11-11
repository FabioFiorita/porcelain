import type { ReactNode } from 'react';
import { Box } from '../../../components/ui/box';
import type { TopBarAction } from '../../../components/ui/top-bar-items';
import { useAtom } from '@effect/atom-react';
import {
  reviewedCommandFailure,
  reviewedCommands,
} from '@porcelain/client/changes';
import { unavailableReviewText } from '@porcelain/client/changes/rules';
import { reviewErrorMessage } from '@porcelain/client/changes/rules';
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
): { action: TopBarAction | undefined; notice: ReactNode } {
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

function reviewedButtonLabel(status: ReviewFile['reviewStatus']) {
  if (status === 'reviewed') return 'Unmark reviewed';
  if (status === 'stale') return 'Review again';
  return 'Mark reviewed';
}
