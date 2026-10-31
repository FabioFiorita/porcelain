import { useAtomRef, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { readReviewPullRequest } from '@porcelain/client/reviews';
import {
  pullRequestHeadLabel,
  pullRequestStateLabel,
  reviewPullRequestNotice,
  type PullRequestRead,
} from '@porcelain/client/reviews/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import type { PullRequestDocument } from '../../../shared/rules/workspace-documents';
import { remoteConnectionState } from '../../../shared/application/store';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { MarkdownView } from '../../../components/ui/markdown-view';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { PullRequestArchive } from '../../projects';
import { pullRequestMarkdown } from '../rules/pull-request-document';

export function PullRequestDocumentContent({
  document,
}: {
  document: PullRequestDocument;
}) {
  const connection = useAtomRef(remoteConnectionState).find(
    (entry) => entry.remote.environmentId === document.environmentId,
  )?.connection;
  return connection ? (
    <ConnectedPullRequest document={document} connection={connection} />
  ) : (
    <ErrorState message="The pull request's computer is unavailable. Reconnect it in Settings → Computers." />
  );
}

function ConnectedPullRequest({
  document,
  connection,
}: {
  document: PullRequestDocument;
  connection: RuntimeConnection;
}) {
  const query = readReviewPullRequest({
    connection,
    reviewId: document.reviewId,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  const link = usePreviewLink();
  const unavailable = AsyncResult.isFailure(result)
    ? { kind: 'failed' as const }
    : { kind: 'loading' as const };
  const pull: PullRequestRead | typeof unavailable = AsyncResult.isSuccess(
    result,
  )
    ? result.value
    : unavailable;
  if (pull.kind === 'loading') return <Loading label="Reading pull request…" />;
  if (pull.kind !== 'available')
    return (
      <ErrorState
        message={
          reviewPullRequestNotice(pull) ??
          'This review no longer has a linked pull request.'
        }
        retry={{
          label: 'Read pull request again',
          onPress: refresh,
          pending: result.waiting,
        }}
      />
    );
  if (pull.pullRequest.number !== document.number)
    return (
      <ErrorState message="This review now links to a different pull request. Return to Worktrees and open its current PR." />
    );
  const available = pull.pullRequest;
  return (
    <Box className="min-w-0 flex-1" gap={2}>
      <Box padding={4} gap={2}>
        <Text variant="heading">
          #{available.number} {available.title}
        </Text>
        <Text variant="caption" tone="muted">
          {pullRequestStateLabel(available)} · {available.headBranch} →{' '}
          {available.baseBranch}
        </Text>
        <Text variant="caption">
          {pullRequestHeadLabel(available)} · {available.headSha}
        </Text>
        <Box className="flex-row flex-wrap" gap={2}>
          <Button
            label="Read pull request again"
            variant="ghost"
            pending={result.waiting}
            onPress={refresh}
          />
          <Button
            label="Open on GitHub"
            variant="outline"
            onPress={() => link.open(available.url)}
          />
        </Box>
        {available.state !== 'open' ? (
          <PullRequestArchive
            projectId={document.projectId}
            reviewId={document.reviewId}
            connection={connection}
          />
        ) : null}
        {link.error ? <ErrorState message={link.error} /> : null}
      </Box>
      <MarkdownView
        source={pullRequestMarkdown(available)}
        onLink={(url) => link.open(url)}
      />
    </Box>
  );
}
