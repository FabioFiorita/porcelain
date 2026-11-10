import type { WalkthroughConversationsResponse } from '@porcelain/contracts/walkthroughs';

export type Conversation =
  WalkthroughConversationsResponse['conversations'][number];
export type DeveloperMessage = Extract<
  Conversation['messages'][number],
  { author: 'developer' }
>;
export type AgentMessage = Extract<
  Conversation['messages'][number],
  { author: 'agent' }
>;

export function postControls(
  message: DeveloperMessage,
): 'posted' | 'saved' | 'available' {
  return message.post.status === 'none' ? 'available' : message.post.status;
}

export function earlierConversations(
  view: WalkthroughConversationsResponse,
  titles: readonly string[],
) {
  return view.conversations.filter(
    ({ anchor }) =>
      anchor.kind === 'walkthrough' || !titles.includes(anchor.title),
  );
}

export function conversationFailure(error: unknown): {
  text: string;
  copy: boolean;
} {
  if (
    typeof error === 'object' &&
    error !== null &&
    (('status' in error && error.status === 409) ||
      ('name' in error && error.name === 'WalkthroughRepositoryChangedError'))
  )
    return { text: 'Nothing was posted. Copy the brief instead.', copy: true };
  return {
    text:
      error instanceof Error ? error.message : 'The request failed. Try again.',
    copy: false,
  };
}
