import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { readProjectPullRequest } from '@porcelain/client/projects';
import {
  pullRequestStateLabel,
  type PullRequestRead,
} from '@porcelain/client/projects/rules';
import { githubUnavailable } from '@porcelain/client/projects/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import {
  PullRequestArchive,
  useComputerConnection,
} from '../../projects/index';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { MarkdownView } from '../../../components/ui/markdown-view';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { pullRequestMarkdown } from '../rules/pull-request-document';
import type { PullRequestTarget } from '../../../shared/rules/pull-request-target';

export function PullRequestContent({ target }: { target: PullRequestTarget }) {
  const connection = useComputerConnection(target.environmentId);
  return connection ? (
    <ConnectedPullRequest target={target} connection={connection} />
  ) : (
    <ErrorState message="The pull request's computer is unavailable. Reconnect it in Settings → Computers." />
  );
}

function ConnectedPullRequest({
  target,
  connection,
}: {
  target: PullRequestTarget;
  connection: RuntimeConnection;
}) {
  const query = readProjectPullRequest({
    connection,
    projectId: target.projectId,
    number: target.number,
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
          pull.kind === 'unavailable'
            ? githubUnavailable(pull.reason).description
            : 'The pull request could not be read.'
        }
        retry={{
          label: 'Read pull request again',
          onPress: refresh,
          pending: result.waiting,
        }}
      />
    );
  const available = pull.pullRequest;
  return (
    <Box className="min-w-0 flex-1" gap={2}>
      <Box padding={4} gap={2}>
        <Text variant="title">
          #{available.number} {available.title}
        </Text>
        <Text variant="caption" tone="muted">
          {pullRequestStateLabel(available)} · {available.headBranch} →{' '}
          {available.baseBranch}
        </Text>
        <Text variant="caption">{available.headSha}</Text>
        <Box className="flex-row flex-wrap" gap={2}>
          <Button
            label="Read pull request again"
            variant="plain"
            pending={result.waiting}
            onPress={refresh}
          />
          <Button
            label="Open on GitHub"
            variant="tonal"
            onPress={() => link.open(available.url)}
          />
        </Box>
        {available.state !== 'open' ? (
          <PullRequestArchive
            projectId={target.projectId}
            number={target.number}
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
