import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import {
  readCommentThreads,
  readPublishedReview,
} from '@porcelain/client/reviews';
import {
  anchorLabel,
  anchorPath,
  decisionKey,
  decisionMentions,
  messageRevision,
  publishedLabel,
  reviewErrorMessage,
  threadStateLabel,
  threadWriteTarget,
  type CommentMessage,
  type CommentThread,
  type ReviewLayer,
} from '@porcelain/client/reviews/rules';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Input } from '../../../components/ui/input';
import { IconButton } from '../../../components/ui/icon-button';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { KeyboardDock } from '../../../components/ui/keyboard-dock';
import { Separator } from '../../../components/ui/separator';
import type { Workspace } from '../../projects';
import { useResolveThread, useVisibleComments } from '../commands/comments';
import { useLinkedReview } from '../queries/linked-review';
import { useWalkthroughRoutes } from './walkthrough-routes';
import { ReviewReadState } from './read-state';
import { useCommentDraft } from './comment-draft';

export function CommentThreadSheet({
  workspace,
  threadId,
  fromDecision,
}: {
  workspace: Workspace;
  threadId: string;
  fromDecision: boolean;
}) {
  const query = readCommentThreads({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  useVisibleComments(workspace, false);
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={refresh} />;
  const thread = result.value.find((entry) => entry.id === threadId);
  if (!thread)
    return (
      <Empty
        title="Thread unavailable"
        description="This thread was deleted. Return to the review."
      />
    );
  return (
    <ThreadSheet
      workspace={workspace}
      thread={thread}
      fromDecision={fromDecision}
    />
  );
}

function ThreadSheet({
  workspace,
  thread,
  fromDecision,
}: {
  workspace: Workspace;
  thread: CommentThread;
  fromDecision: boolean;
}) {
  const router = useRouter();
  const resolve = useResolveThread(workspace, thread);
  const draft = useCommentDraft(
    workspace,
    { ...threadWriteTarget(thread), anchor: thread.anchor },
    () => undefined,
    undefined,
    '',
    { document: JSON.stringify(['thread', thread.id]), keepTarget: true },
  );
  const published = useAtomValue(
    readPublishedReview({
      connection: workspace.connection,
      scope: workspace.scope,
    }),
  );
  const review = AsyncResult.isSuccess(published) ? published.value : undefined;
  const routes = useWalkthroughRoutes(workspace);
  const sameReview =
    !thread.review ||
    (thread.review.reviewId === review?.reviewId &&
      thread.review.revision === review.revision);
  const openDecision =
    review && sameReview
      ? (layer: ReviewLayer) => {
          router.back();
          if (fromDecision) routes.showStop(decisionKey(layer.id));
          else routes.openStop(decisionKey(layer.id));
        }
      : undefined;
  const path = anchorPath(thread.anchor);
  return (
    <>
      <KeyboardDock>
        <Box className="flex-1" surface="background" collapsable={false}>
          <Box className="flex-1 overflow-hidden" collapsable={false}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentInsetAdjustmentBehavior="automatic"
              contentContainerClassName="gap-4 p-4"
            >
              <Box className="flex-row items-center" gap={2}>
                <Box className="min-w-0 flex-1" gap={1}>
                  <Text variant="headline">{sheetTitle(thread)}</Text>
                  <Text variant="caption" weight="medium">
                    {threadStateLabel(thread)}
                  </Text>
                </Box>
                <Button
                  label={resolve.label}
                  size="sm"
                  variant="tonal"
                  pending={resolve.result.waiting}
                  onPress={resolve.toggle}
                />
              </Box>
              {path ? (
                <Text variant="code" tone="muted" selectable>
                  {path}
                </Text>
              ) : null}
              {AsyncResult.isFailure(resolve.result) ? (
                <ErrorState
                  message={reviewErrorMessage(
                    Cause.squash(resolve.result.cause),
                  )}
                />
              ) : null}
              {thread.review ? (
                <RevisionMessages
                  workspace={workspace}
                  reviewId={thread.review.reviewId}
                  messages={thread.messages}
                  layers={review?.layers ?? []}
                  onDecision={openDecision}
                />
              ) : (
                <Messages
                  messages={thread.messages}
                  revisions={[]}
                  layers={review?.layers ?? []}
                  onDecision={openDecision}
                />
              )}
            </ScrollView>
          </Box>
          {thread.resolved && !draft.body ? null : <Separator />}
          {thread.resolved && !draft.body ? null : (
            <Box paddingX={4} paddingY={3} gap={2}>
              {draft.error ? (
                <Text
                  variant="caption"
                  tone="destructive"
                  accessibilityRole="alert"
                >
                  {draft.error}
                </Text>
              ) : null}
              <Box className="flex-row items-center" gap={2}>
                <Box className="flex-1">
                  <Input
                    testID="review-comment-input"
                    accessibilityLabel="Review comment"
                    placeholder="Reply…"
                    value={draft.body}
                    onChangeText={draft.edit}
                    disabled={draft.pending}
                    invalid={!!draft.error}
                    returnKeyType="send"
                    onSubmitEditing={() => {
                      if (draft.body.trim()) draft.submit();
                    }}
                  />
                </Box>
                <IconButton
                  icon="send"
                  variant="filled"
                  accessibilityLabel="Send reply"
                  disabled={!draft.body.trim()}
                  pending={draft.pending}
                  onPress={draft.submit}
                />
              </Box>
            </Box>
          )}
        </Box>
      </KeyboardDock>
    </>
  );
}

type MessageProps = {
  layers: readonly ReviewLayer[];
  onDecision: ((layer: ReviewLayer) => void) | undefined;
};

function RevisionMessages({
  workspace,
  reviewId,
  ...props
}: MessageProps & {
  workspace: Workspace;
  reviewId: string;
  messages: readonly CommentMessage[];
}) {
  const { result } = useLinkedReview({
    connection: workspace.connection,
    reviewId,
  });
  return (
    <Messages
      {...props}
      revisions={AsyncResult.isSuccess(result) ? result.value.revisions : []}
    />
  );
}

function Messages({
  messages,
  revisions,
  layers,
  onDecision,
}: MessageProps & {
  messages: readonly CommentMessage[];
  revisions: Parameters<typeof messageRevision>[1];
}) {
  return messages.map((message) => {
    const revision = messageRevision(message, revisions);
    const meta = [
      revision === undefined ? undefined : `on r${revision}`,
      message.createdAt ? publishedLabel(message.createdAt) : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <Box key={message.id} gap={1}>
        <Box className="flex-row items-baseline" gap={2}>
          <Text variant="secondary" weight="medium">
            {message.author === 'agent' ? 'Agent' : 'You'}
          </Text>
          {meta ? (
            <Text variant="caption" tone="muted">
              {meta}
            </Text>
          ) : null}
        </Box>
        <Text variant="secondary" selectable>
          {decisionMentions(
            message.body,
            onDecision && message.author === 'agent' ? layers.length : 0,
          ).map((segment, index) => {
            const layer =
              segment.kind === 'decision'
                ? layers[segment.decision - 1]
                : undefined;
            return layer && onDecision ? (
              <Text
                key={index}
                variant="secondary"
                tone="brand"
                weight="medium"
                accessibilityRole="link"
                accessibilityLabel={`Open decision: ${layer.title}`}
                onPress={() => onDecision(layer)}
              >
                {segment.text}
              </Text>
            ) : (
              segment.text
            );
          })}
        </Text>
      </Box>
    );
  });
}

function sheetTitle(thread: CommentThread) {
  const anchor = thread.anchor;
  if (anchor.kind !== 'codeRange') return anchorLabel(anchor);
  return anchor.startLine === anchor.endLine
    ? `Line ${anchor.startLine}`
    : `Lines ${anchor.startLine}–${anchor.endLine}`;
}
