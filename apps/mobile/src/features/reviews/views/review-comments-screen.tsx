import { Box } from '../../../components/ui/box';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Stack, useRouter, usePreventRemove } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Alert, ScrollView } from 'react-native';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { commentCommands, readCommentThreads } from '@porcelain/client/reviews';
import {
  anchorLabel,
  anchorPath,
  commentBodyValid,
  commentIsStale,
  retainIntent,
  threadStateLabel,
  type CommentAnchor,
  type CommentThread,
} from '@porcelain/client/reviews/rules';
import { reviewErrorMessage } from '@porcelain/client/reviews/rules';
import { ReviewAnnotation } from '../../../components/ui/review-annotation';
import { ReviewComposer } from '../../../components/ui/review-composer';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import {
  useReviewWorkspace,
  type ReviewWorkspace,
} from '../adapters/workspace';
import { commentBodyLimit, useCommentWrite } from '../commands/comments';
import { ReviewReadState } from './read-state';
import { useReviewSnapshot } from '../queries/review';
import { type ReviewComparison } from '../rules/comparison';

export function ReviewCommentsScreen({
  workspaceKey,
  path,
  anchor,
  compose,
  comparison,
}: {
  workspaceKey?: string | undefined;
  path?: string | undefined;
  anchor?: CommentAnchor | undefined;
  compose: boolean;
  comparison: ReviewComparison;
}) {
  const router = useRouter();
  const workspace = useReviewWorkspace(workspaceKey ?? '');
  return (
    <>
      <Stack.Screen options={{ title: path ? 'File comments' : 'Comments' }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button onPress={() => router.back()}>
          Done
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      {workspace ? (
        <Comments
          key={`${workspace.key}:${path}:${JSON.stringify(anchor)}`}
          workspace={workspace}
          path={path}
          anchor={anchor}
          compose={compose}
          comparison={comparison}
        />
      ) : (
        <Empty
          title="Review unavailable"
          description="Return to Review and select a worktree."
        />
      )}
    </>
  );
}

function Comments({
  workspace,
  path,
  anchor,
  compose,
  comparison,
}: {
  workspace: ReviewWorkspace;
  path?: string | undefined;
  anchor?: CommentAnchor | undefined;
  compose: boolean;
  comparison: ReviewComparison;
}) {
  const query = readCommentThreads({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  const [composer, setComposer] = useState<
    { anchor: CommentAnchor; threadId?: string } | undefined
  >(() => (compose && anchor ? { anchor } : undefined));
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (composer) scroll.current?.scrollTo({ y: 0, animated: true });
  }, [composer]);
  const commands = commentCommands({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const seen = useCommentWrite(commands.seen);
  const highest =
    AsyncResult.isSuccess(result) && !path
      ? result.value.reduce(
          (value, thread) => Math.max(value, thread.revision),
          0,
        )
      : 0;
  const marked = useRef(0);
  useEffect(() => {
    if (highest > marked.current) {
      marked.current = highest;
      seen.send(highest);
    }
  }, [highest, seen]);
  return (
    <Box className="flex-1" surface="background" collapsable={false}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 p-4"
      >
        {path ? (
          <Text variant="caption" tone="muted" selectable>
            {path}
          </Text>
        ) : null}
        {composer ? (
          <>
            <AnchorFreshness
              workspace={workspace}
              anchor={composer.anchor}
              comparison={comparison}
            />
            {composer.threadId &&
            AsyncResult.isSuccess(result) &&
            !result.value.some((thread) => thread.id === composer.threadId) ? (
              <ErrorState message="This thread is no longer available. Your reply is kept; cancel it to start another comment." />
            ) : null}
            <CommentComposer
              key={composer.threadId ?? 'new'}
              workspace={workspace}
              anchor={composer.anchor}
              threadId={composer.threadId}
              onClose={() => setComposer(undefined)}
            />
          </>
        ) : null}
        {anchor ? (
          <Button
            label={(() => {
              if (anchor.kind === 'codeRange') {
                return 'Comment on selected lines';
              }
              if (path) {
                return 'Comment on file';
              }
              if (comparison.kind === 'branch') {
                return 'Comment on the whole branch';
              }
              return 'Comment on the whole change';
            })()}
            variant="outline"
            disabled={!!composer}
            onPress={() => setComposer({ anchor })}
          />
        ) : null}
        {AsyncResult.isSuccess(result) ? (
          <>
            {result.value
              .filter((thread) => !path || anchorPath(thread.anchor) === path)
              .map((thread) => (
                <CommentThreadView
                  key={thread.id}
                  workspace={workspace}
                  thread={thread}
                  canReply={!composer}
                  onReply={() =>
                    setComposer({ threadId: thread.id, anchor: thread.anchor })
                  }
                />
              ))}
            {result.value.filter(
              (thread) => !path || anchorPath(thread.anchor) === path,
            ).length === 0 ? (
              <Empty
                title="No comments"
                description="Feedback and agent replies will appear here."
              />
            ) : null}
          </>
        ) : (
          <ReviewReadState result={result} refresh={refresh} />
        )}
      </ScrollView>
    </Box>
  );
}

function AnchorFreshness({
  workspace,
  anchor,
  comparison,
}: {
  workspace: ReviewWorkspace;
  anchor: CommentAnchor;
  comparison: ReviewComparison;
}) {
  const snapshot = useReviewSnapshot(workspace, comparison);
  if (!AsyncResult.isSuccess(snapshot.result))
    return (
      <Text variant="caption" tone="muted">
        The current comparison could not be confirmed. Your comment retains the
        code you selected.
      </Text>
    );
  if (anchor.kind === 'change') return null;
  const value = snapshot.result.value;
  const fingerprint =
    value.kind === 'worktree'
      ? value.answer.changes.find((file) => file.path === anchor.filePath)
          ?.fingerprint
      : value.answer.files.find((file) => file.path === anchor.filePath)
          ?.fingerprint;
  return commentIsStale(anchor, {
    filePath: anchor.filePath,
    contentFingerprint: fingerprint ?? undefined,
  }) ? (
    <Text variant="caption" tone="muted">
      Code changed since you selected it. This comment refers to the earlier
      comparison.
    </Text>
  ) : null;
}

function CommentComposer({
  workspace,
  anchor,
  threadId,
  onClose,
}: {
  workspace: ReviewWorkspace;
  anchor: CommentAnchor;
  threadId?: string | undefined;
  onClose: () => void;
}) {
  const commands = commentCommands({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const create = useCommentWrite(commands.create);
  const reply = useCommentWrite(commands.reply);
  const pending = threadId ? reply.result.waiting : create.result.waiting;
  const mutationError = (() => {
    if (threadId) {
      if (AsyncResult.isFailure(reply.result)) {
        return reviewErrorMessage(Cause.squash(reply.result.cause));
      }
      return undefined;
    }
    if (AsyncResult.isFailure(create.result)) {
      return reviewErrorMessage(Cause.squash(create.result.cause));
    }
    return undefined;
  })();
  const [body, setBody] = useState('');
  const [invalid, setInvalid] = useState<string>();
  const intent = useRef<
    { body: string; threadId: string; messageId: string } | undefined
  >(undefined);
  const error = invalid ?? mutationError;
  const confirmDiscard = (complete: () => void) => {
    if (pending) {
      Alert.alert(
        'Sending comment',
        'Wait for the comment to finish sending before closing.',
      );
      return;
    }
    if (body.length === 0) {
      complete();
      return;
    }
    Alert.alert('Discard comment?', 'Your unsent comment will be lost.', [
      { text: 'Keep writing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setBody('');
          complete();
        },
      },
    ]);
  };
  usePreventRemove(body.length > 0 || pending, ({ repeat }) =>
    confirmDiscard(repeat),
  );

  return (
    <ReviewComposer
      value={body}
      onChangeText={(value) => {
        setBody(value);
        setInvalid(undefined);
      }}
      label={`${anchorPath(anchor) ?? ''} ${anchorLabel(anchor)}${threadId ? ' · Reply' : ''}`}
      pending={pending}
      {...(error ? { error } : {})}
      onCancel={() => confirmDiscard(onClose)}
      onSubmit={() => {
        if (pending) return;
        if (!commentBodyValid(body)) {
          setInvalid(
            `Enter a comment of at most ${commentBodyLimit} characters without a NUL character.`,
          );
          return;
        }
        intent.current = retainIntent(intent.current, body, () => ({
          body,
          threadId: threadId ?? randomUUID(),
          messageId: randomUUID(),
        }));
        const input = intent.current;
        if (threadId)
          reply.send({ threadId, messageId: input.messageId, body }, onClose);
        else
          create.send(
            {
              threadId: input.threadId,
              messageId: input.messageId,
              body,
              anchor,
            },
            onClose,
          );
      }}
    />
  );
}

function CommentThreadView({
  workspace,
  thread,
  canReply,
  onReply,
}: {
  workspace: ReviewWorkspace;
  thread: CommentThread;
  canReply: boolean;
  onReply: () => void;
}) {
  const commands = commentCommands({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const resolve = useCommentWrite(commands.resolve);
  return (
    <Box gap={2}>
      <Text variant="caption" tone="muted">
        {[
          anchorPath(thread.anchor),
          anchorLabel(thread.anchor),
          threadStateLabel(thread),
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {thread.messages.map((message) => (
        <ReviewAnnotation
          key={message.id}
          author={message.author}
          body={message.body}
          resolved={thread.resolved}
        />
      ))}
      <Box className="flex-row" gap={2}>
        <Button
          label={thread.resolved ? 'Reopen' : 'Resolve'}
          size="sm"
          variant="outline"
          pending={resolve.result.waiting}
          onPress={() => {
            if (!resolve.result.waiting)
              resolve.send({ threadId: thread.id, resolved: !thread.resolved });
          }}
        />
        {!thread.resolved ? (
          <Button
            label="Reply"
            size="sm"
            variant="ghost"
            disabled={!canReply}
            onPress={onReply}
          />
        ) : null}
      </Box>
      {AsyncResult.isFailure(resolve.result) ? (
        <ErrorState
          message={reviewErrorMessage(Cause.squash(resolve.result.cause))}
        />
      ) : null}
    </Box>
  );
}
