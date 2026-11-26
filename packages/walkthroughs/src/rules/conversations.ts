import type {
  ConversationAnchor,
  StoredWalkthroughMessage,
  WalkthroughConversation,
  WalkthroughConversationsView,
  WalkthroughMessage,
} from '../models/conversation.ts';
import type { WalkthroughRun } from '../models/walkthrough.ts';
import type { CallDecision } from '../models/decision.ts';

function stopsOf(run: WalkthroughRun | undefined) {
  return run?.state.status === 'ready' ? run.state.content.stops : [];
}

function messagesOf(
  stored: StoredWalkthroughMessage,
): readonly WalkthroughMessage[] {
  return [
    {
      author: 'developer',
      id: stored.id,
      text: stored.text,
      createdAt: stored.createdAt,
    },
    {
      author: 'agent',
      id: `${stored.id}:answer`,
      replyTo: stored.id,
      createdAt: stored.createdAt,
      state: stored.answer,
    },
  ];
}

export function conversationsView(
  readyRuns: readonly WalkthroughRun[],
  messages: readonly StoredWalkthroughMessage[],
  decisions: readonly CallDecision[] = [],
): WalkthroughConversationsView {
  const latest = readyRuns.at(-1);
  const current = new Set(stopsOf(latest).map((stop) => stop.title));
  const anchorFor = (stored: StoredWalkthroughMessage): ConversationAnchor =>
    stored.stopTitle !== undefined &&
    (stored.runId === latest?.id || current.has(stored.stopTitle))
      ? { kind: 'stop', title: stored.stopTitle }
      : { kind: 'walkthrough' };
  const grouped = new Map<string, WalkthroughConversation>();
  for (const stored of messages) {
    const key = JSON.stringify([stored.runId, stored.stopTitle]);
    const existing = grouped.get(key);
    grouped.set(
      key,
      existing === undefined
        ? {
            runId: stored.runId,
            anchor: anchorFor(stored),
            messages: messagesOf(stored),
          }
        : {
            ...existing,
            messages: [...existing.messages, ...messagesOf(stored)],
          },
    );
  }
  return {
    runId: latest?.id,
    pullRequestNumber: latest?.pullRequestNumber,
    conversations: [...grouped.values()],
    decisions,
  };
}
