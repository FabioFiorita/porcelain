import type { WalkthroughConversationsResponse } from '@porcelain/contracts/walkthroughs';

type Conversation = WalkthroughConversationsResponse['conversations'][number];
type Message = Conversation['messages'][number];
type DeveloperMessage = Extract<Message, { author: 'developer' }>;
type AgentMessage = Extract<Message, { author: 'agent' }>;

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

export function savedMessageCount(
  view: WalkthroughConversationsResponse,
): number {
  return view.conversations
    .flatMap(developerMessages)
    .filter((message) => message.post.status === 'saved').length;
}

export function canPostMessage(message: DeveloperMessage): boolean {
  return message.post.status !== 'posted';
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

export function postDestination(
  view: WalkthroughConversationsResponse,
): 'pull-request' | 'copy' {
  return view.pullRequestNumber === undefined ? 'copy' : 'pull-request';
}
