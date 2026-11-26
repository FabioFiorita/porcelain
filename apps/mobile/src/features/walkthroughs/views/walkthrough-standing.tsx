import { useAtomValue } from '@effect/atom-react';
import {
  readWalkthroughMergeReview,
  type WalkthroughPull,
} from '@porcelain/client/walkthroughs';
import { walkthroughStanding } from '@porcelain/client/projects/rules';
import type {
  WalkthroughContent,
  WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Icon } from '../../../components/ui/icon';
import { Text } from '../../../components/ui/text';
import { useOpenPullRequest, type Workspace } from '../../projects/index';
import { RESULT_ICONS } from './walkthrough-blocks';

export function WalkthroughStanding({
  workspace,
  run,
  content,
  pull,
}: {
  workspace: Workspace;
  run: WalkthroughRun;
  content: WalkthroughContent;
  pull: WalkthroughPull;
}) {
  const openPullRequest = useOpenPullRequest();
  const review = useAtomValue(
    readWalkthroughMergeReview({
      connection: workspace.connection,
      scope: workspace.scope,
      runId: run.id,
      headOid: run.headOid,
      content,
    }),
  );
  const standing = walkthroughStanding({ pull, review });
  if (!standing) return null;
  const { label, quiet, pullState } = standing;
  const icon = RESULT_ICONS[standing.icon];
  return (
    <Box gap={2} className="items-start" accessibilityLabel="Merge status">
      {label ? (
        <Box className="flex-row items-center" gap={2}>
          <Icon name={icon.name} tone={icon.tone} size="small" />
          <Text
            variant="secondary"
            weight={quiet ? 'normal' : 'medium'}
            tone={quiet ? 'muted' : 'default'}
            accessibilityRole="summary"
            className="min-w-0 flex-1"
          >
            {label}
          </Text>
        </Box>
      ) : null}
      {pull ? (
        <Button
          label={`#${pull.number}${pullState ? ` · ${pullState}` : ''}`}
          accessibilityLabel={`Open pull request #${pull.number}${pullState ? `, ${pullState}` : ''}`}
          variant="tonal"
          size="sm"
          onPress={() =>
            openPullRequest({
              environmentId: workspace.connection.environmentId,
              projectId: workspace.scope.projectId,
              number: pull.number,
            })
          }
        />
      ) : null}
    </Box>
  );
}
