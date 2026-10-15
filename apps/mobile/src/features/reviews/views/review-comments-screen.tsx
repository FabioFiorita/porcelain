import { Box } from '../../../components/ui/box';
import { useState, type ReactNode } from 'react';
import { Stack, useRouter, usePreventRemove } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Alert, ScrollView } from 'react-native';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { readCommentThreads } from '@porcelain/client/reviews';
import {
  anchorLabel,
  anchorPath,
  commentBodyValid,
  commentIsStale,
  matchesCommentTarget,
  type CommentTarget,
  retainIntent,
  threadStateLabel,
  type CommentAnchor,
  type CommentThread,
} from '@porcelain/client/reviews/rules';
import { reviewErrorMessage } from '@porcelain/client/reviews/rules';
import { ReviewAnnotation } from '../../../components/ui/review-annotation';
import { ReviewComposer } from '../../../components/ui/review-composer';
import { Text } from '../../../components/ui/text';
import { headerIcon } from '../../../shared/icons/header-icon';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import {
  WorkspaceGate,
  useDocumentLeave,
  type Workspace,
} from '../../projects';
import {
  commentBodyLimit,
  useCommentCommands,
  useVisibleComments,
  useCommentWrite,
} from '../commands/comments';
import { documentCommentContext } from '../rules/document-comment';
import { ReviewReadState } from './read-state';
import { useReviewSnapshot } from '../queries/review';
import type { ReviewComparison } from '../../../shared/rules/review-comparison';

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
  return (
    <>
      <Stack.Screen options={{ title: path ? 'File comments' : 'Comments' }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={headerIcon('done')}
          accessibilityLabel="Done"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
      <WorkspaceGate
        title="Review"
        expectedWorkspace={workspaceKey ?? ''}
        changed={
          <Empty
            title="Review unavailable"
            description="Return to Review and select a worktree."
          />
        }
      >
        {(workspace) => (
          <CommentThreads
            key={`${workspace.key}:${path}:${JSON.stringify(anchor)}`}
            workspace={workspace}
            path={path}
            anchor={anchor}
            compose={compose}
            comparison={comparison}
          />
        )}
      </WorkspaceGate>
    </>
  );
}

export type CommentWorkspace = Pick<Workspace, 'connection' | 'scope'>;

type ComposerTarget = { anchor: CommentAnchor; threadId?: string | undefined };

export function CommentThreads({
  workspace,
  path,
  anchor,
  compose,
  comparison,
  currentTarget,
  onComposerChange,
  leaveScope,
}: {
  workspace: CommentWorkspace;
  path?: string | undefined;
  anchor?: CommentAnchor | undefined;
  compose: boolean;
  comparison?: ReviewComparison | undefined;
  currentTarget?: CommentTarget | undefined;
  leaveScope?: string | undefined;
  onComposerChange?: ((anchor: CommentAnchor | undefined) => void) | undefined;
}) {
  const query = readCommentThreads({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  const [target, setTarget] = useState<ComposerTarget | undefined>(() =>
    compose && anchor ? { anchor } : undefined,
  );
  const draft = useCommentDraft(
    workspace,
    target,
    () => {
      setTarget(undefined);
      onComposerChange?.(undefined);
    },
    leaveScope,
  );
  const open = (next: ComposerTarget) =>
    draft.confirmDiscard(() => {
      setTarget(next);
      onComposerChange?.(next.anchor);
    });
  useVisibleComments(workspace, !path);

  const threads = AsyncResult.isSuccess(result)
    ? result.value.filter((thread) =>
        currentTarget
          ? matchesCommentTarget(thread.anchor, currentTarget)
          : !path || anchorPath(thread.anchor) === path,
      )
    : [];
  const replyTarget = target?.threadId;
  const orphanedReply =
    replyTarget !== undefined &&
    !threads.some((thread) => thread.id === replyTarget);
  const composer = target ? (
    <CommentComposer
      draft={draft}
      target={target}
      showContext={currentTarget !== undefined}
    />
  ) : null;
  return (
    <Box className="flex-1" surface="background" collapsable={false}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 p-4"
      >
        {path ? (
          <Text variant="caption" tone="muted" selectable>
            {path}
          </Text>
        ) : null}
        {orphanedReply ? (
          <>
            {AsyncResult.isSuccess(result) ? (
              <ErrorState message="This thread is no longer available. Your reply is kept; cancel it to start another comment." />
            ) : null}
            {composer}
          </>
        ) : null}
        {target && replyTarget === undefined ? (
          <>
            {currentTarget ? (
              <TargetFreshness anchor={target.anchor} target={currentTarget} />
            ) : null}
            {!currentTarget && comparison ? (
              <AnchorFreshness
                workspace={workspace}
                anchor={target.anchor}
                comparison={comparison}
              />
            ) : null}
            {composer}
          </>
        ) : null}
        {anchor && (!target || replyTarget !== undefined) ? (
          <Button
            label={newCommentLabel(anchor, path, comparison)}
            variant="outline"
            onPress={() => open({ anchor })}
          />
        ) : null}
        {AsyncResult.isSuccess(result) ? (
          <>
            {threads.map((thread) => (
              <CommentThreadView
                key={thread.id}
                workspace={workspace}
                thread={thread}
                replying={replyTarget === thread.id}
                currentTarget={currentTarget}
                onReply={() =>
                  open({ threadId: thread.id, anchor: thread.anchor })
                }
              >
                {replyTarget === thread.id ? composer : null}
              </CommentThreadView>
            ))}
            {threads.length === 0 ? (
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

function newCommentLabel(
  anchor: CommentAnchor,
  path: string | undefined,
  comparison: ReviewComparison | undefined,
) {
  if (anchor.kind === 'codeRange') return 'Comment on selected lines';
  if (path) return 'Comment on file';
  if (comparison?.kind === 'branch') return 'Comment on the whole branch';
  return 'Comment on the whole change';
}

function AnchorFreshness({
  workspace,
  anchor,
  comparison,
}: {
  workspace: CommentWorkspace;
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

function useCommentDraft(
  workspace: CommentWorkspace,
  target: ComposerTarget | undefined,
  onClose: () => void,
  leaveScope?: string,
) {
  const commands = useCommentCommands(workspace);
  const create = useCommentWrite(commands.create);
  const reply = useCommentWrite(commands.reply);
  const result = target?.threadId ? reply.result : create.result;
  const pending = target !== undefined && result.waiting;
  const [body, setBody] = useState('');
  const [invalid, setInvalid] = useState<string>();
  const [intent, setIntent] = useState<
    { body: string; threadId: string; messageId: string } | undefined
  >(undefined);
  const failure = target ? writeFailure(result) : undefined;
  const reset = (complete: () => void) => {
    setBody('');
    setInvalid(undefined);
    setIntent(undefined);
    create.reset();
    reply.reset();
    complete();
  };
  const confirmDiscard = (complete: () => void) => {
    if (pending) {
      Alert.alert(
        'Sending comment',
        'Wait for the comment to finish sending before closing.',
      );
      return;
    }
    if (body.length === 0) {
      reset(complete);
      return;
    }
    Alert.alert('Discard comment?', 'Your unsent comment will be lost.', [
      { text: 'Keep writing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => reset(complete),
      },
    ]);
  };
  useDocumentLeave(
    leaveScope,
    body.length > 0 || pending ? confirmDiscard : undefined,
  );
  usePreventRemove(body.length > 0 || pending, ({ repeat }) =>
    confirmDiscard(repeat),
  );
  return {
    body,
    pending,
    error: invalid ?? failure,
    edit: (value: string) => {
      setBody(value);
      setInvalid(undefined);
    },
    cancel: () => confirmDiscard(onClose),
    submit: () => {
      if (!target || pending) return;
      if (!commentBodyValid(body)) {
        setInvalid(
          `Enter a comment of at most ${commentBodyLimit} characters without a NUL character.`,
        );
        return;
      }
      const input = retainIntent(intent, body, () => ({
        body,
        threadId: target.threadId ?? randomUUID(),
        messageId: randomUUID(),
      }));
      setIntent(input);
      const sent = () => reset(onClose);
      if (target.threadId)
        reply.send(
          { threadId: target.threadId, messageId: input.messageId, body },
          sent,
        );
      else
        create.send(
          {
            threadId: input.threadId,
            messageId: input.messageId,
            body,
            anchor: target.anchor,
          },
          sent,
        );
    },
    confirmDiscard,
  };
}

function writeFailure(result: AsyncResult.AsyncResult<unknown, unknown>) {
  return AsyncResult.isFailure(result)
    ? reviewErrorMessage(Cause.squash(result.cause))
    : undefined;
}

function CommentComposer({
  draft,
  target,
  showContext,
}: {
  draft: ReturnType<typeof useCommentDraft>;
  target: ComposerTarget;
  showContext: boolean;
}) {
  return (
    <ReviewComposer
      value={draft.body}
      onChangeText={draft.edit}
      label={`${anchorPath(target.anchor) ?? ''} ${anchorLabel(target.anchor)}${showContext ? ` · ${documentCommentContext(target.anchor)}` : ''}${target.threadId ? ' · Reply' : ''}`}
      pending={draft.pending}
      {...(draft.error ? { error: draft.error } : {})}
      onCancel={draft.cancel}
      onSubmit={draft.submit}
    />
  );
}

function CommentThreadView({
  workspace,
  thread,
  replying,
  onReply,
  children,
  currentTarget,
}: {
  workspace: CommentWorkspace;
  thread: CommentThread;
  replying: boolean;
  onReply: () => void;
  children: ReactNode;
  currentTarget?: CommentTarget | undefined;
}) {
  const commands = useCommentCommands(workspace);
  const resolve = useCommentWrite(commands.resolve);
  return (
    <Box gap={2}>
      <Text variant="caption" tone="muted">
        {[
          anchorPath(thread.anchor),
          anchorLabel(thread.anchor),
          currentTarget ? documentCommentContext(thread.anchor) : undefined,
          threadStateLabel(thread),
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {currentTarget ? (
        <TargetFreshness anchor={thread.anchor} target={currentTarget} />
      ) : null}
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
            disabled={replying}
            onPress={onReply}
          />
        ) : null}
      </Box>
      {AsyncResult.isFailure(resolve.result) ? (
        <ErrorState
          message={reviewErrorMessage(Cause.squash(resolve.result.cause))}
        />
      ) : null}
      {children}
    </Box>
  );
}

function TargetFreshness({
  anchor,
  target,
}: {
  anchor: CommentAnchor;
  target: CommentTarget;
}) {
  return commentIsStale(anchor, target) ||
    !matchesCommentTarget(anchor, target) ? (
    <Text variant="caption" tone="muted">
      Code changed since this comment was anchored. It refers to the earlier
      saved code.
    </Text>
  ) : null;
}
