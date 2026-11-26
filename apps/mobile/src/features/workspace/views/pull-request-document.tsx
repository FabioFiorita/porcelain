import { useState, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import {
  githubUnavailable,
  pullRequestConversation,
  pullRequestRepository,
  pullRequestState,
  pullRequestStateLabel,
  pullReviewState,
  PULL_REQUEST_COMMENT_CHARACTERS,
  type PullRequestRead,
} from '@porcelain/client/projects/rules';
import { useComputerConnection } from '../../projects/index';
import { useWritesBlocked } from '../../access';
import { commitAge } from '@porcelain/client/history/rules';
import { Badge } from '../../../components/ui/badge';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/document-header';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { Indent } from '../../../components/ui/indent';
import { IconButton } from '../../../components/ui/icon-button';
import { MarkdownText } from '../../../components/ui/markdown-text';
import { MessageComposer } from '../../../components/ui/message-composer';
import { SectionHeading } from '../../../components/ui/section-heading';
import { Text } from '../../../components/ui/text';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import type { PullRequestTarget } from '../../../shared/rules/pull-request-target';
import { useScreenActivity } from '../adapters/page-activity';
import { useCommentOnPullRequest } from '../commands/pull-request';
import {
  usePullRequestMerge,
  type PullRequestRef,
} from '../queries/pull-request';
import { PullRequestReadState } from './pull-request-read';
import { PullRequestChecks } from './pull-request-checks';
import { PullRequestMergeArea } from './pull-request-merge';

type PullRequest = Extract<
  PullRequestRead,
  { kind: 'available' }
>['pullRequest'];
type TimelineItem = PullRequest['timeline'][number];

const reviewBadges = {
  passed: 'open',
  failed: 'closed',
  none: 'outline',
} as const;

export function PullRequestContent({ target }: { target: PullRequestTarget }) {
  const connection = useComputerConnection(target.environmentId);
  return connection ? (
    <ConnectedPullRequest
      target={{
        connection,
        projectId: target.projectId,
        number: target.number,
      }}
    />
  ) : (
    <Box padding={4}>
      <ErrorState message="The pull request's computer is unavailable. Reconnect it in Settings → Computers." />
    </Box>
  );
}

function ConnectedPullRequest({ target }: { target: PullRequestRef }) {
  return (
    <PullRequestReadState target={target}>
      {(pull) => <PullRequestPage target={target} pull={pull} />}
    </PullRequestReadState>
  );
}

function PullRequestPage({
  target,
  pull,
}: {
  target: PullRequestRef;
  pull: PullRequest;
}) {
  const activity = useScreenActivity();
  const merge = usePullRequestMerge(target, pull, activity);
  const link = usePreviewLink();
  return (
    <>
      <PageHeader
        title={`PR #${pull.number}`}
        actions={[
          {
            kind: 'button',
            id: 'github',
            label: 'Open on GitHub',
            icon: 'openExternal',
            onPress: () => link.open(pull.url),
          },
        ]}
      />
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="w-full max-w-3xl self-center gap-6 p-4 pb-12"
      >
        {link.error ? <ErrorState message={link.error} /> : null}
        <PullRequestHeader pull={merge.pull} />
        <PullRequestMergeArea target={target} merge={merge} />
        {merge.problem ? (
          <ChecksProblem
            problem={merge.problem}
            stale={merge.status !== undefined}
            reading={merge.reading}
            onRetry={merge.refresh}
          />
        ) : null}
        {merge.status ? (
          <PullRequestChecks
            target={target}
            status={merge.status}
            pendingReruns={merge.pendingReruns}
          />
        ) : null}
        <Box gap={2}>
          <SectionHeading
            label="Description"
            trailing={
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {[
                  pull.author ? `by ${pull.author}` : undefined,
                  pull.createdAt ? commitAge(pull.createdAt) : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            }
          />
          {pull.description.trim() ? (
            <MarkdownText source={pull.description} onLink={link.open} />
          ) : (
            <Text variant="secondary" tone="muted">
              No description provided.
            </Text>
          )}
        </Box>
        <PullRequestConversation
          target={target}
          pull={pull}
          onLink={link.open}
        />
      </ScrollView>
    </>
  );
}

function PullRequestHeader({ pull }: { pull: PullRequest }) {
  const repository = pullRequestRepository(pull.url)?.split('/').at(-1);
  return (
    <Box gap={2}>
      <Box className="flex-row items-center" gap={2}>
        <Icon name="pullRequest" tone="muted" size="small" />
        <Text variant="caption" weight="medium" tone="muted" numberOfLines={1}>
          {repository ? `Pull request · ${repository}` : 'Pull request'}
        </Text>
      </Box>
      <Text variant="largeTitle" accessibilityRole="header">
        <Text variant="largeTitle" tone="muted">
          #{pull.number}
        </Text>{' '}
        {pull.title}
      </Text>
      <Box className="flex-row flex-wrap items-center" gap={2}>
        <Badge
          variant={pullRequestState(pull)}
          label={pullRequestStateLabel(pull)}
        />
        {pull.author ? (
          <Text variant="secondary" weight="medium" numberOfLines={1}>
            {pull.author}
          </Text>
        ) : null}
        <Text
          variant="mono"
          numberOfLines={1}
          accessibilityLabel={`Merges ${pull.headBranch} into ${pull.baseBranch}`}
        >
          {pull.baseBranch} ← {pull.headBranch}
        </Text>
        <Text variant="caption" tone="muted">
          updated {commitAge(pull.updatedAt)}
        </Text>
      </Box>
      {pull.labels.length > 0 ? (
        <Box className="flex-row flex-wrap" gap={1} accessibilityLabel="Labels">
          {pull.labels.map((label, index) => (
            <Badge
              key={`${label.name}:${index}`}
              variant="outline"
              label={label.name}
              labelNumberOfLines={1}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function ChecksProblem({
  problem,
  stale,
  reading,
  onRetry,
}: {
  problem: NonNullable<ReturnType<typeof usePullRequestMerge>['problem']>;
  stale: boolean;
  reading: boolean;
  onRetry: () => void;
}) {
  const reason =
    problem === 'failed'
      ? 'The checks could not be read.'
      : githubUnavailable(problem).description;
  return (
    <Box className="flex-row flex-wrap items-center" gap={2}>
      <Text variant="secondary" tone="muted" className="min-w-0 flex-1">
        {stale ? `Showing the last read. ${reason}` : reason}
      </Text>
      <Button
        label="Try again"
        variant="tonal"
        size="sm"
        pending={reading}
        onPress={onRetry}
      />
    </Box>
  );
}

function PullRequestConversation({
  target,
  pull,
  onLink,
}: {
  target: PullRequestRef;
  pull: PullRequest;
  onLink: (url: string) => void;
}) {
  const conversation = pullRequestConversation(pull.timeline);
  return (
    <Box gap={3}>
      <SectionHeading
        label="Conversation"
        trailing={
          <Text variant="caption" tone="muted">
            {pull.timeline.length}
          </Text>
        }
      />
      {conversation.length > 0 ? (
        conversation.map(({ item, comments }) => (
          <TimelineEntry key={item.id} item={item} onLink={onLink}>
            {comments.length > 0 ? (
              <Indent kind="thread">
                {comments.map((comment) => (
                  <TimelineEntry
                    key={comment.id}
                    item={comment}
                    onLink={onLink}
                  />
                ))}
              </Indent>
            ) : null}
          </TimelineEntry>
        ))
      ) : (
        <Text variant="secondary" tone="muted">
          No comments or reviews on GitHub yet.
        </Text>
      )}
      {pull.truncated ? (
        <Text variant="caption" tone="muted">
          Some labels or conversation items are not shown. Open on GitHub to see
          everything.
        </Text>
      ) : null}
      <PullRequestComposer target={target} />
    </Box>
  );
}

function TimelineEntry({
  item,
  onLink,
  children,
}: {
  item: TimelineItem;
  onLink: (url: string) => void;
  children?: ReactNode;
}) {
  const review = pullReviewState(item.reviewState);
  const line = item.line ?? item.originalLine;
  const file =
    item.path === undefined
      ? undefined
      : `${item.path}${line === undefined ? '' : `:${line}`}`;
  return (
    <Box gap={1}>
      <Box className="flex-row flex-wrap items-center" gap={2}>
        <Text variant="secondary" weight="semibold" numberOfLines={1}>
          {item.author ?? 'Unknown author'}
        </Text>
        {review ? (
          <Badge variant={reviewBadges[review.tone]} label={review.label} />
        ) : null}
        <Text variant="caption" tone="muted" className="flex-1">
          {!review && item.kind === 'comment' ? 'commented · ' : ''}
          {commitAge(item.time)}
        </Text>
        <IconButton
          icon="external"
          size="sm"
          accessibilityLabel={`Open this ${item.kind === 'review' ? 'review' : 'comment'} on GitHub`}
          onPress={() => onLink(item.url)}
        />
      </Box>
      {file ? (
        <Text variant="mono" tone="muted" numberOfLines={1}>
          {file} · review comment
        </Text>
      ) : null}
      {item.diffHunk ? (
        <Card>
          <Box padding={2}>
            <Text variant="mono" selectable>
              {item.diffHunk}
            </Text>
          </Box>
        </Card>
      ) : null}
      {item.body.trim() ? (
        <MarkdownText source={item.body} onLink={onLink} />
      ) : null}
      {children}
    </Box>
  );
}

function PullRequestComposer({ target }: { target: PullRequestRef }) {
  const [body, setBody] = useState('');
  const offline = useWritesBlocked(target.connection.environmentId);
  const comment = useCommentOnPullRequest(target, () => setBody(''));
  return (
    <MessageComposer
      value={body}
      placeholder="Comment on GitHub"
      maxLength={PULL_REQUEST_COMMENT_CHARACTERS}
      sending={comment.pending}
      disabled={offline}
      error={offline ? 'The computer is offline.' : comment.failure}
      onChangeText={setBody}
      onSend={() => {
        if (body.trim()) void comment.submit(body);
      }}
    />
  );
}
