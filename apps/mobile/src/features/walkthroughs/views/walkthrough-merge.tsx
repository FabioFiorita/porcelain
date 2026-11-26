import { useAtomValue } from '@effect/atom-react';
import { useRouter } from 'expo-router';
import { readWalkthroughMergeReview } from '@porcelain/client/walkthroughs';
import {
  mergeButtonReason,
  mergeReadiness,
  pullRequestMergeBlock,
} from '@porcelain/client/projects/rules';
import type {
  WalkthroughContent,
  WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import { useWritesBlocked } from '../../access';
import {
  PullRequestArchive,
  useOpenPullRequest,
  type Workspace,
} from '../../projects/index';
import type { WalkthroughPull } from '@porcelain/client/walkthroughs';

export function WalkthroughMerge({
  workspace,
  run,
  content,
  pull: found,
}: {
  workspace: Workspace;
  run: WalkthroughRun;
  content: WalkthroughContent;
  pull: WalkthroughPull;
}) {
  const router = useRouter();
  const openPullRequest = useOpenPullRequest();
  const blocked = useWritesBlocked(workspace.connection.environmentId);
  const review = useAtomValue(
    readWalkthroughMergeReview({
      connection: workspace.connection,
      scope: workspace.scope,
      runId: run.id,
      headOid: run.headOid,
      content,
    }),
  );
  const pull = found?.detail;
  if (!found || !pull) return null;
  const { number } = found;
  const { projectId } = workspace.scope;
  const environmentId = workspace.connection.environmentId;
  const block = pullRequestMergeBlock(pull, review);
  const reason = mergeButtonReason(
    block,
    mergeReadiness({
      status: found.status,
      baseBranch: pull.baseBranch,
      mergeMethods: pull.mergeMethods,
      review,
    }).waitsFor,
  );
  return (
    <Box gap={3} accessibilityLabel={`Pull request #${number}`}>
      <Separator />
      {pull.state === 'open' ? (
        <>
          <Box className="flex-row flex-wrap items-center" gap={2}>
            <Button
              label={`Merge #${number}`}
              size="sm"
              disabled={block !== undefined || blocked}
              onPress={() =>
                router.push({
                  pathname: '/merge-pull-request',
                  params: {
                    environment: environmentId,
                    projectId,
                    number: String(number),
                  },
                })
              }
            />
            <Button
              label={`Open #${number}`}
              variant="plain"
              size="sm"
              onPress={() =>
                openPullRequest({ environmentId, projectId, number })
              }
            />
          </Box>
          {reason ? (
            <Text variant="secondary" tone="muted">
              {reason}
            </Text>
          ) : null}
        </>
      ) : (
        <Box className="flex-row flex-wrap items-center" gap={3}>
          <Text variant="secondary" tone="muted">
            #{number} is {pull.state}.
          </Text>
          <PullRequestArchive
            projectId={projectId}
            number={number}
            connection={workspace.connection}
          />
        </Box>
      )}
    </Box>
  );
}
