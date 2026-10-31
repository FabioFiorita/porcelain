import { useAtom } from '@effect/atom-react';
import { useState } from 'react';
import { usePreventRemove } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Alert } from 'react-native';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  commentBodyValid,
  retainIntent,
  reviewErrorMessage,
} from '@porcelain/client/reviews/rules';
import {
  commentDraftState,
  type ComposerTarget,
  type CommentDraft,
} from '../store';
import { useDocumentLeave, type Workspace } from '../../projects';
import {
  commentBodyLimit,
  useCommentCommands,
  useCommentWrite,
} from '../commands/comments';

export type CommentWorkspace = Pick<Workspace, 'connection' | 'scope'>;

export type { ComposerTarget } from '../store';

export function useCommentDraft(
  workspace: CommentWorkspace,
  initialTarget: ComposerTarget | undefined,
  onClose: () => void,
  leaveScope?: string,
  initialBody = '',
  options: { document: string; keepTarget?: boolean } = {
    document: 'comments',
  },
) {
  const [openingTarget, setOpeningTarget] = useState(initialTarget);
  const owner = JSON.stringify([
    workspace.connection.environmentId,
    workspace.scope,
    options.document,
  ]);
  const [saved, setSaved] = useAtom(commentDraftState(owner));
  const initial: CommentDraft = {
    target: openingTarget,
    body: initialBody,
    invalid: undefined,
    intent: undefined,
  };
  const state = saved ?? initial;
  const { target, body, invalid, intent } = state;
  const update = (change: Partial<CommentDraft>) =>
    setSaved((current) => ({ ...(current ?? initial), ...change }));
  const commands = useCommentCommands(workspace, owner);
  const create = useCommentWrite(commands.create);
  const reply = useCommentWrite(commands.reply);
  const result = target?.threadId ? reply.result : create.result;
  const pending = target !== undefined && result.waiting;
  const failure = target ? writeFailure(result) : undefined;
  const dirty = body.length > 0 && body !== initialBody;
  const reset = (complete: () => void) => {
    if (options.keepTarget)
      update({ body: '', invalid: undefined, intent: undefined });
    else {
      setOpeningTarget(undefined);
      setSaved(undefined);
    }
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
    if (!dirty) {
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
  useDocumentLeave(leaveScope, dirty || pending ? confirmDiscard : undefined);
  usePreventRemove(dirty || pending, ({ repeat }) => confirmDiscard(repeat));
  return {
    target,
    setTarget: (next: ComposerTarget | undefined) => update({ target: next }),
    body,
    pending,
    error: invalid ?? failure,
    edit: (value: string) => {
      update({ body: value, invalid: undefined });
    },
    cancel: () => confirmDiscard(onClose),
    submit: () => {
      if (!target || pending) return;
      if (initialBody.length > 0 && body.trim() === initialBody.trim()) {
        update({ invalid: 'Write your comment after the prefilled text.' });
        return;
      }
      if (!commentBodyValid(body)) {
        update({
          invalid: `Enter a comment of at most ${commentBodyLimit} characters without a NUL character.`,
        });
        return;
      }
      const input = retainIntent(intent, body, () => ({
        body,
        threadId: target.threadId ?? randomUUID(),
        messageId: randomUUID(),
      }));
      update({ intent: input });
      const sent = () => reset(onClose);
      if (target.threadId)
        reply.send(
          {
            threadId: target.threadId,
            reviewId: target.reviewId,
            messageId: input.messageId,
            body,
          },
          sent,
        );
      else
        create.send(
          {
            threadId: input.threadId,
            reviewId: target.reviewId,
            reviewRevision: target.reviewRevision,
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
