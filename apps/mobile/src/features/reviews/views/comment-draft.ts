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
  type CommentAnchor,
} from '@porcelain/client/reviews/rules';
import { useDocumentLeave, type Workspace } from '../../projects';
import {
  commentBodyLimit,
  useCommentCommands,
  useCommentWrite,
} from '../commands/comments';

export type CommentWorkspace = Pick<Workspace, 'connection' | 'scope'>;

export type ComposerTarget = {
  anchor: CommentAnchor;
  threadId?: string | undefined;
};

export function useCommentDraft(
  workspace: CommentWorkspace,
  target: ComposerTarget | undefined,
  onClose: () => void,
  leaveScope?: string,
  initialBody = '',
) {
  const commands = useCommentCommands(workspace);
  const create = useCommentWrite(commands.create);
  const reply = useCommentWrite(commands.reply);
  const result = target?.threadId ? reply.result : create.result;
  const pending = target !== undefined && result.waiting;
  const [body, setBody] = useState(initialBody);
  const [invalid, setInvalid] = useState<string>();
  const [intent, setIntent] = useState<
    { body: string; threadId: string; messageId: string } | undefined
  >(undefined);
  const failure = target ? writeFailure(result) : undefined;
  const dirty = body.length > 0 && body !== initialBody;
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
      if (initialBody.length > 0 && body.trim() === initialBody.trim()) {
        setInvalid('Write your comment after the prefilled text.');
        return;
      }
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

function writeFailure(
  result: AsyncResult.AsyncResult<unknown, unknown>,
) {
  return AsyncResult.isFailure(result)
    ? reviewErrorMessage(Cause.squash(result.cause))
    : undefined;
}
