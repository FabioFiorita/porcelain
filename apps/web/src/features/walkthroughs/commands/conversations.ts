import { useState } from 'react';
import { copyText } from '@/shared/workspace/copy';
import {
  conversationFailure,
  type DeveloperMessage,
} from '../rules/conversations';
import { useAtom } from '@effect/atom-react';
import { Cause, Exit } from 'effect';
import { AsyncResult, type Atom } from 'effect/reactivity';
import { walkthroughConversationCommands } from '@porcelain/client/walkthroughs';
import {
  conversationSelection,
  type ConversationScope,
} from '../queries/conversations';

function useCommand<I, A, E>(atom: Atom.AtomResultFn<I, A, E>) {
  const [result, send] = useAtom(atom, { mode: 'promiseExit' });
  return {
    waiting: AsyncResult.isWaiting(result),
    run: async (input: I) => {
      const exit = await send(input);
      if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
      return exit.value;
    },
  };
}

function useConversationCommands(props: ConversationScope) {
  const commands = walkthroughConversationCommands(
    conversationSelection(props),
  );
  return {
    add: useCommand(commands.addMessage),
    retry: useCommand(commands.retryAnswer),
    save: useCommand(commands.saveMessage),
    post: useCommand(commands.postMessage),
    postSaved: useCommand(commands.postSavedMessages),
    brief: useCommand(commands.readBrief),
  };
}

export function usePostActions(
  owner: ConversationScope,
  message: DeveloperMessage | undefined,
) {
  const commands = useConversationCommands(owner);
  const [notice, setNotice] = useState<{ text: string; copy: boolean }>();
  const waiting =
    commands.post.waiting ||
    commands.postSaved.waiting ||
    commands.save.waiting ||
    commands.brief.waiting;
  const failed = (error: unknown) => setNotice(conversationFailure(error));
  const copy = () =>
    void commands.brief.run(message?.id).then((text) => {
      if (text) copyText(text, 'brief', false);
    }, failed);
  const save = (saved: boolean) => {
    if (message)
      void commands.save.run({ messageId: message.id, saved }).catch(failed);
  };
  const post = () => {
    setNotice(undefined);
    const pending = message
      ? commands.post.run(message.id)
      : commands.postSaved.run(undefined);
    void pending.then((result) => {
      if (result.outcome.status === 'brief')
        copyText(result.outcome.text, 'brief', false);
      if (
        result.outcome.status === 'posted' &&
        result.outcome.notPosted.length > 0
      ) {
        const ids = result.outcome.notPosted;
        const texts = result.view.conversations
          .flatMap((item) => item.messages)
          .filter(
            (item): item is DeveloperMessage =>
              item.author === 'developer' && ids.includes(item.id),
          )
          .map((item) => item.text);
        setNotice({
          text: `Still saved: ${texts.join('; ')}. These comments belong to a different repository.`,
          copy: false,
        });
      }
    }, failed);
  };

  return {
    notice,
    waiting,
    copy,
    save,
    post,
  };
}

export function useRetryAnswer(owner: ConversationScope, messageId: string) {
  const [failure, setFailure] = useState<string>();
  const commands = useConversationCommands(owner);
  const retry = () => {
    setFailure(undefined);
    void commands.retry
      .run(messageId)
      .catch((error: unknown) => setFailure(conversationFailure(error).text));
  };
  return {
    failure,
    waiting: commands.retry.waiting,
    retry,
  };
}

export function useSendMessage(owner: ConversationScope) {
  const [failure, setFailure] = useState<string>();
  const commands = useConversationCommands(owner);
  return {
    failure,
    waiting: commands.add.waiting,
    send: (
      payload: Parameters<typeof commands.add.run>[0],
      done: () => void,
    ) => {
      setFailure(undefined);
      void commands.add
        .run(payload)
        .then(done, (error: unknown) =>
          setFailure(conversationFailure(error).text),
        );
    },
  };
}
