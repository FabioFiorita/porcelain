import { Stack, useRouter } from 'expo-router';
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
import { headerIcon } from '../../../shared/icons/header-icon';
import { sheetDismissButton } from '../../../shared/navigation/sheet-presentation';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Input } from '../../../components/ui/input';
import { IconButton } from '../../../components/ui/icon-button';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { KeyboardDock } from '../../../components/ui/keyboard-dock';
import { Separator } from '../../../components/ui/separator';
import type { Workspace } from '../../projects';
import {
  useCommentCommands,
  useCommentWrite,
  useVisibleComments,
} from '../commands/comments';
import { useLinkedReview } from '../queries/linked-review';
import { useReviewPlace } from '../store';
import { ReviewReadState } from './read-state';
import { useCommentDraft } from './comment-draft';

export function CommentThreadSheet({
  workspace,
  threadId,
}: {
  workspace: Workspace;
  threadId: string;
}) {
  const query = readCommentThreads({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  useVisibleComments(workspace, false);
  if (!AsyncResult.isSuccess(result))
    return (
      <>
        <SheetHeader title="Comment" />
        <ReviewReadState result={result} refresh={refresh} />
      </>
    );
  const thread = result.value.find((entry) => entry.id === threadId);
  if (!thread)
    return (
      <>
        <SheetHeader title="Comment" />
        <Empty
          title="Thread unavailable"
          description="This thread was deleted. Return to the review."
        />
      </>
    );
  return <ThreadSheet workspace={workspace} thread={thread} />;
}

function SheetHeader({
  title,
  resolve,
}: {
  title: string;
  resolve?: {
    label: string;
    icon: 'resolve' | 'reopen';
    pending: boolean;
    onPress: () => void;
  };
}) {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title, headerBackButtonMenuEnabled: false }} />
      {resolve || sheetDismissButton ? (
        <Stack.Toolbar placement="right">
          {resolve ? (
            <Stack.Toolbar.Button
              icon={headerIcon(resolve.icon)}
              disabled={resolve.pending}
              accessibilityLabel={resolve.label}
              onPress={resolve.onPress}
            >
              {resolve.label}
            </Stack.Toolbar.Button>
          ) : null}
          {sheetDismissButton ? (
            <Stack.Toolbar.Button
              icon={headerIcon('done')}
              accessibilityLabel="Done"
              onPress={() => router.back()}
            />
          ) : null}
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

function ThreadSheet({
  workspace,
  thread,
}: {
  workspace: Workspace;
  thread: CommentThread;
}) {
  const router = useRouter();
  const commands = useCommentCommands(workspace);
  const resolve = useCommentWrite(commands.resolve);
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
  const [, setPlace] = useReviewPlace(
    review
      ? JSON.stringify([workspace.key, review.publishedAt, review.revision])
      : '',
  );
  const sameReview =
    !thread.review ||
    (thread.review.reviewId === review?.reviewId &&
      thread.review.revision === review.revision);
  const openDecision =
    review && sameReview
      ? (layer: ReviewLayer) => {
          setPlace({ stop: decisionKey(layer.id), summary: false });
          router.back();
        }
      : undefined;
  const path = anchorPath(thread.anchor);
  return (
    <>
      <SheetHeader
        title={sheetTitle(thread)}
        resolve={{
          label: thread.resolved ? 'Reopen' : 'Resolve',
          icon: thread.resolved ? 'reopen' : 'resolve',
          pending: resolve.result.waiting,
          onPress: () => {
            if (!resolve.result.waiting)
              resolve.send({
                ...threadWriteTarget(thread),
                resolved: !thread.resolved,
              });
          },
        }}
      />
      <KeyboardDock>
        <Box className="flex-1" surface="background" collapsable={false}>
          <Box className="flex-1 overflow-hidden" collapsable={false}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentInsetAdjustmentBehavior="automatic"
              contentContainerClassName="gap-4 p-4"
            >
              {path ? (
                <Text variant="code" tone="muted" selectable>
                  {path}
                </Text>
              ) : null}
              <Text variant="caption" weight="medium">
                {threadStateLabel(thread)}
              </Text>
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
                  variant="default"
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
          <Text variant="ui" weight="medium">
            {message.author === 'agent' ? 'Agent' : 'You'}
          </Text>
          {meta ? (
            <Text variant="caption" tone="muted">
              {meta}
            </Text>
          ) : null}
        </Box>
        <Text variant="ui" selectable>
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
                variant="link"
                tone="primary"
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
