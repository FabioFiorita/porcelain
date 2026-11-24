import { useState } from 'react';
import { useAtom, useAtomSet } from '@effect/atom-react';
import type { Atom } from 'effect/reactivity';
import {
  walkthroughCommandBinding,
  walkthroughConversationCommands,
} from '@porcelain/client/walkthroughs';
import {
  conversationFailure,
  postOutcome,
  type DeveloperMessage,
} from '@porcelain/client/walkthroughs/rules';
import { showClipboardNotice } from '../../../shared/application/clipboard-notice';
import { copyToClipboard } from '../../../shared/adapters/clipboard';
import {
  conversationSelection,
  type ConversationOwner,
} from '../queries/conversations';
import { stillSavedNotice, type PostNotice } from '../rules/post-notice';

function useBound<I, A, E>(command: Atom.AtomResultFn<I, A, E>) {
  return walkthroughCommandBinding(useAtom(command, { mode: 'promiseExit' }));
}

function commandsOf(owner: ConversationOwner) {
  return walkthroughConversationCommands(conversationSelection(owner));
}

export function usePostActions(
  owner: ConversationOwner,
  message: DeveloperMessage | undefined,
) {
  const commands = commandsOf(owner);
  const notify = useAtomSet(showClipboardNotice);
  const postOne = useBound(commands.postMessage);
  const postSaved = useBound(commands.postSavedMessages);
  const saving = useBound(commands.saveMessage);
  const brief = useBound(commands.readBrief);
  const [notice, setNotice] = useState<PostNotice>();
  const fail = (error: unknown) => setNotice(conversationFailure(error));
  const toClipboard = (text: string) =>
    copyToClipboard(text).then(
      () => notify('brief'),
      () => setNotice({ text: 'Could not copy the brief.', copy: false }),
    );
  return {
    notice,
    waiting:
      postOne.waiting || postSaved.waiting || saving.waiting || brief.waiting,
    copy: () => {
      setNotice(undefined);
      brief
        .run(message?.id)
        .then((text) => (text ? toClipboard(text) : undefined))
        .catch(fail);
    },
    save: (saved: boolean) => {
      setNotice(undefined);
      if (message) saving.run({ messageId: message.id, saved }).catch(fail);
    },
    post: () => {
      setNotice(undefined);
      (message ? postOne.run(message.id) : postSaved.run(undefined))
        .then((answer) => {
          const outcome = postOutcome(answer);
          if (outcome.kind === 'brief') return toClipboard(outcome.text);
          if (outcome.kind === 'still-saved')
            setNotice(stillSavedNotice(outcome.messages.length));
          return undefined;
        })
        .catch(fail);
    },
  };
}

export function useAnswerRetry(owner: ConversationOwner) {
  const retry = useBound(commandsOf(owner).retryAnswer);
  const [failure, setFailure] = useState<string>();
  return {
    failure,
    waiting: retry.waiting,
    retry: (messageId: string) => {
      setFailure(undefined);
      retry
        .run(messageId)
        .catch((error: unknown) => setFailure(conversationFailure(error).text));
    },
  };
}

export function useAsk(owner: ConversationOwner, title: string) {
  const add = useBound(commandsOf(owner).addMessage);
  const [failure, setFailure] = useState<string>();
  return {
    failure,
    waiting: add.waiting,
    ask: (text: string, sent: () => void) => {
      setFailure(undefined);
      add
        .run({ anchor: { kind: 'stop', title }, text })
        .then(sent)
        .catch((error: unknown) => setFailure(conversationFailure(error).text));
    },
  };
}
