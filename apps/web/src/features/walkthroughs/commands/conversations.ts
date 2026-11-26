import { useState } from 'react';
import {
  callDecisionRequest,
  conversationFailure,
} from '@porcelain/client/walkthroughs/rules';
import { useAtom } from '@effect/atom-react';
import { type Atom } from 'effect/reactivity';
import {
  walkthroughCommandBinding,
  walkthroughConversationCommands,
  walkthroughDraft,
  walkthroughDraftBinding,
} from '@porcelain/client/walkthroughs';
import { useCommentCommands } from '@/features/comments/index';
import {
  conversationSelection,
  type ConversationScope,
} from '../queries/conversations';

function useCommand<I, A, E>(atom: Atom.AtomResultFn<I, A, E>) {
  return walkthroughCommandBinding(useAtom(atom, { mode: 'promiseExit' }));
}

function useConversationCommands(props: ConversationScope) {
  const commands = walkthroughConversationCommands(
    conversationSelection(props),
  );
  return {
    retry: useCommand(commands.retryAnswer),
  };
}

export function useRetryAnswer(owner: ConversationScope, messageId: string) {
  const [failure, setFailure] = useState<string>();
  const commands = useConversationCommands(owner);
  const retry = () => {
    setFailure(undefined);
    void commands.retry
      .run(messageId)
      .catch((error: unknown) => setFailure(conversationFailure(error)));
  };
  return {
    failure,
    waiting: commands.retry.waiting,
    retry,
  };
}

export function useSendMessage(owner: ConversationScope, title: string) {
  const selection = conversationSelection(owner);
  return walkthroughDraftBinding(
    useAtom(walkthroughDraft(selection, owner.run, title)),
    useCommand(walkthroughConversationCommands(selection).addMessage),
    { runId: selection.runId, title },
  );
}

export function useDecideCall(owner: ConversationScope) {
  const decide = useCommand(
    walkthroughConversationCommands(conversationSelection(owner)).decideCall,
  );
  const [failure, setFailure] = useState<string>();
  return {
    failure,
    waiting: decide.waiting,
    decide: (input: {
      step: number;
      call: number;
      decided: boolean;
      option?: string | undefined;
    }) => {
      setFailure(undefined);
      void decide
        .run(callDecisionRequest(input))
        .catch((error: unknown) => setFailure(conversationFailure(error)));
    },
  };
}

export function useAddToReview(owner: ConversationScope, stepTitle: string) {
  const commands = useCommentCommands({
    scope: owner.scope,
    context: owner.context,
  });
  const [added, setAdded] = useState(false);
  const [failure, setFailure] = useState<string>();
  return {
    added,
    failure,
    waiting: commands.add.waiting,
    add: (text: string) => {
      setFailure(undefined);
      void commands.add
        .run({ anchor: { kind: 'step', title: stepTitle }, text })
        .then(
          () => setAdded(true),
          () => setFailure('The comment was not saved. Try again.'),
        );
    },
  };
}
