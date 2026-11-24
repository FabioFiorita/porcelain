import type { AddWalkthroughMessageRequest } from '@porcelain/contracts/walkthroughs';
import { conversationFailure } from '../rules/conversations.ts';
import type { WalkthroughDraft } from '../store/draft.ts';

export function walkthroughDraftBinding(
  [draft, update]: readonly [
    WalkthroughDraft,
    (change: (draft: WalkthroughDraft) => WalkthroughDraft) => void,
  ],
  command: {
    waiting: boolean;
    run: (request: AddWalkthroughMessageRequest) => Promise<unknown>;
  },
  title: string,
) {
  const text = draft.text.trim();
  const waiting = draft.sending || command.waiting;
  return {
    text: draft.text,
    failure: draft.failure,
    waiting,
    change: (text: string) => update((current) => ({ ...current, text })),
    send: () => {
      if (!text || waiting) return;
      update((current) => ({ ...current, failure: undefined, sending: true }));
      void command.run({ anchor: { kind: 'stop', title }, text }).then(
        () =>
          update((current) => ({
            ...current,
            text: current.text === draft.text ? '' : current.text,
            sending: false,
          })),
        (error: unknown) =>
          update((current) => ({
            ...current,
            failure: conversationFailure(error).text,
            sending: false,
          })),
      );
    },
  };
}
