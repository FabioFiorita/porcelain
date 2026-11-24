import { useState } from 'react';
import { useAtom, useAtomSet } from '@effect/atom-react';
import type { Atom } from 'effect/reactivity';
import {
  walkthroughCommandBinding,
  walkthroughConversationCommands,
  walkthroughDraft,
  walkthroughDraftBinding,
  type WalkthroughDraftPlacement,
} from '@porcelain/client/walkthroughs';
import {
  conversationFailure,
  postOutcome,
  type DeveloperMessage,
} from '@porcelain/client/walkthroughs/rules';
import { notify as notifyCommand } from '../../../shared/application/notify';
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
  const notify = useAtomSet(notifyCommand);
  const postOne = useBound(commands.postMessage);
  const postSaved = useBound(commands.postSavedMessages);
  const saving = useBound(commands.saveMessage);
  const brief = useBound(commands.readBrief);
  const [notice, setNotice] = useState<PostNotice>();
  const fail = (error: unknown) => setNotice(conversationFailure(error));
  const toClipboard = (text: string) =>
    copyToClipboard(text).then(
      () => notify({ kind: 'copy', target: 'brief' }),
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

export function useAsk(
  owner: ConversationOwner,
  title: string,
  placement: WalkthroughDraftPlacement,
) {
  const selection = conversationSelection(owner);
  return walkthroughDraftBinding(
    useAtom(walkthroughDraft(selection, owner.run, title, placement)),
    useBound(walkthroughConversationCommands(selection).addMessage),
    { runId: selection.runId, title },
  );
}
