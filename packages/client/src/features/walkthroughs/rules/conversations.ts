import type { WalkthroughConversationsResponse } from '@porcelain/contracts/walkthroughs';

export type Conversation =
  WalkthroughConversationsResponse['conversations'][number];
type Message = Conversation['messages'][number];
export type DeveloperMessage = Extract<Message, { author: 'developer' }>;
export type AgentMessage = Extract<Message, { author: 'agent' }>;

export type WalkthroughAnchor = Conversation['anchor'];

export function conversationsAt(
  view: WalkthroughConversationsResponse,
  anchor: WalkthroughAnchor,
): readonly Conversation[] {
  return view.conversations.filter(
    (conversation) =>
      conversation.anchor.kind === anchor.kind &&
      (conversation.anchor.kind === 'walkthrough' ||
        (anchor.kind === 'stop' && conversation.anchor.title === anchor.title)),
  );
}

function developerMessages(
  conversation: Conversation,
): readonly DeveloperMessage[] {
  return conversation.messages.filter(
    (message): message is DeveloperMessage => message.author === 'developer',
  );
}

export function answerTo(
  conversation: Conversation,
  messageId: string,
): AgentMessage | undefined {
  return conversation.messages.find(
    (message): message is AgentMessage =>
      message.author === 'agent' && message.replyTo === messageId,
  );
}

export function canRetryAnswer(message: AgentMessage): boolean {
  return message.state.status === 'failed';
}

export function isAnswering(view: WalkthroughConversationsResponse): boolean {
  return view.conversations.some((conversation) =>
    conversation.messages.some(
      (message) =>
        message.author === 'agent' && message.state.status === 'answering',
    ),
  );
}

export function earlierConversations(
  view: WalkthroughConversationsResponse | undefined,
  titles: readonly string[],
) {
  return (view?.conversations ?? []).filter(
    ({ anchor }) =>
      anchor.kind === 'walkthrough' || !titles.includes(anchor.title),
  );
}

export function conversationFailure(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'The request failed. Try again.';
}

export function developerTurns(conversation: Conversation) {
  return developerMessages(conversation).map((message) => ({
    message,
    reply: answerTo(conversation, message.id),
  }));
}

export function stopConversations(
  view: WalkthroughConversationsResponse | undefined,
  title: string,
): readonly Conversation[] {
  return view ? conversationsAt(view, { kind: 'stop', title }) : [];
}
