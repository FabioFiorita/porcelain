import { useState } from 'react';
import { useAtom } from '@effect/atom-react';
import type { Atom } from 'effect/reactivity';
import {
  walkthroughCommandBinding,
  walkthroughConversationCommands,
  walkthroughDraft,
  walkthroughDraftBinding,
} from '@porcelain/client/walkthroughs';
import {
  callDecisionRequest,
  conversationFailure,
} from '@porcelain/client/walkthroughs/rules';
import {
  conversationSelection,
  type ConversationOwner,
} from '../queries/conversations';
import { useWriteAllowed } from '../../access';

function useBound<I, A, E>(command: Atom.AtomResultFn<I, A, E>) {
  return walkthroughCommandBinding(useAtom(command, { mode: 'promiseExit' }));
}

function commandsOf(owner: ConversationOwner) {
  return walkthroughConversationCommands(conversationSelection(owner));
}

export function useAnswerRetry(owner: ConversationOwner) {
  const retry = useBound(commandsOf(owner).retryAnswer);
  const [failure, setFailure] = useState<string>();
  const allowed = useWriteAllowed(owner.workspace.connection.environmentId);
  return {
    failure,
    waiting: retry.waiting,
    retry: (messageId: string) => {
      if (!allowed()) return;
      setFailure(undefined);
      retry
        .run(messageId)
        .catch((error: unknown) => setFailure(conversationFailure(error)));
    },
  };
}

export function useDecideCall(owner: ConversationOwner) {
  const decide = useBound(commandsOf(owner).decideCall);
  const [failure, setFailure] = useState<string>();
  const allowed = useWriteAllowed(owner.workspace.connection.environmentId);
  return {
    failure,
    waiting: decide.waiting,
    decide: (input: {
      step: number;
      call: number;
      decided: boolean;
      option?: string | undefined;
    }) => {
      if (!allowed()) return;
      setFailure(undefined);
      decide
        .run(callDecisionRequest(input))
        .catch((error: unknown) => setFailure(conversationFailure(error)));
    },
  };
}

export function useAsk(owner: ConversationOwner, title: string) {
  const selection = conversationSelection(owner);
  const allowed = useWriteAllowed(owner.workspace.connection.environmentId);
  const binding = walkthroughDraftBinding(
    useAtom(walkthroughDraft(selection, owner.run, title)),
    useBound(walkthroughConversationCommands(selection).addMessage),
    { runId: selection.runId, title },
  );
  return {
    ...binding,
    send: () => {
      if (allowed()) binding.send();
    },
  };
}
