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

export function postControls(
  message: DeveloperMessage | undefined,
): 'posted' | 'saved' | 'available' {
  if (message === undefined || message.post.status === 'none')
    return 'available';
  return message.post.status;
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

const COMMENT_PATH =
  /^[a-z][a-z\d+.-]*:\/\/[^/?#\s]+(\/[^?#\s]*)?(?:[?#]\S*)?$/i;
const ISSUE_NUMBER = /\/(?:pull|issues)\/([1-9]\d*)\/?$/;

export function postedCommentLabel(url: string): string {
  const path = COMMENT_PATH.exec(url)?.[1] ?? '';
  const number = ISSUE_NUMBER.exec(path)?.[1];
  return number === undefined ? 'Posted comment' : `Posted on #${number}`;
}

export function postLabels(pullRequestNumber: number | undefined) {
  return pullRequestNumber === undefined
    ? { single: 'Copy as prompt', together: 'Copy together' }
    : {
        single: `Post on #${pullRequestNumber}`,
        together: `Post together on #${pullRequestNumber}`,
      };
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

export function savedSummary(
  view: WalkthroughConversationsResponse | undefined,
): string | undefined {
  const count = view ? savedMessageCount(view) : 0;
  if (count === 0) return undefined;
  return count === 1 ? '1 comment saved' : `${count} comments saved`;
}

export type PostOutcome =
  | { kind: 'done' }
  | { kind: 'brief'; text: string }
  | { kind: 'still-saved'; messages: readonly DeveloperMessage[] };

type PostAnswer = {
  readonly outcome:
    | { readonly status: 'nothing' }
    | {
        readonly status: 'posted';
        readonly url: string;
        readonly notPosted: readonly string[];
      }
    | { readonly status: 'brief'; readonly text: string };
  readonly view: WalkthroughConversationsResponse;
};

export function postOutcome(answer: PostAnswer): PostOutcome {
  const { outcome } = answer;
  if (outcome.status === 'brief') return { kind: 'brief', text: outcome.text };
  if (outcome.status !== 'posted' || outcome.notPosted.length === 0)
    return { kind: 'done' };
  return {
    kind: 'still-saved',
    messages: answer.view.conversations
      .flatMap(developerMessages)
      .filter((message) => outcome.notPosted.includes(message.id)),
  };
}
