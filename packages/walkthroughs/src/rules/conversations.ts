import type {
  ConversationAnchor,
  PostPlan,
  PostSelection,
  StoredWalkthroughMessage,
  WalkthroughConversation,
  WalkthroughConversationsView,
  WalkthroughMessage,
} from '../models/conversation.ts';
import type { WalkthroughRun } from '../models/walkthrough.ts';

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
      post: stored.post,
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
  };
}

export type BriefItem = {
  readonly text: string;
  readonly stopTitle: string | undefined;
  readonly paths: readonly string[];
  readonly answer: string | undefined;
};

const inOneLine = (text: string) => text.replace(/\s+/g, ' ').trim();
const quoted = (text: string) =>
  text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
const pathList = (paths: readonly string[]) =>
  paths.map((path) => `\`${path}\``).join(', ');

export function composeBrief(items: readonly BriefItem[]): string {
  const [only] = items;
  if (items.length === 1 && only !== undefined) {
    const lines = [quoted(only.text), ''];
    if (only.stopTitle !== undefined)
      lines.push(
        `**Step:** ${only.stopTitle}${only.paths.length ? ` (${pathList(only.paths)})` : ''}`,
      );
    if (only.answer !== undefined)
      lines.push(`**Agent's answer:** ${only.answer}`);
    return `From the walkthrough of this change:\n\n${lines.join('\n').trimEnd()}\n`;
  }
  return `From the walkthrough of this change:\n\n${items
    .map((item) => {
      const where =
        item.stopTitle === undefined
          ? 'Whole walkthrough'
          : `${item.stopTitle}${item.paths.length ? ` (${pathList(item.paths)})` : ''}`;
      const answer =
        item.answer === undefined
          ? ''
          : ` Agent's answer: ${inOneLine(item.answer)}`;
      return `- **${where}:** ${inOneLine(item.text)}${answer}`;
    })
    .join('\n')}\n`;
}

function briefItem(
  stored: StoredWalkthroughMessage,
  runs: ReadonlyMap<string, WalkthroughRun>,
): BriefItem {
  const stop = stopsOf(runs.get(stored.runId)).find(
    (candidate) => candidate.title === stored.stopTitle,
  );
  return {
    text: stored.text,
    stopTitle: stored.stopTitle,
    paths: [
      ...new Set([
        ...(stop?.excerpts ?? []).map((excerpt) => excerpt.path),
        ...(stop?.files ?? []).map((file) => file.path),
      ]),
    ],
    answer:
      stored.answer.status === 'answered' ? stored.answer.text : undefined,
  };
}

export function planPost(input: {
  readonly selection: PostSelection;
  readonly readyRuns: readonly WalkthroughRun[];
  readonly messages: readonly StoredWalkthroughMessage[];
}): PostPlan {
  const selected =
    input.selection.kind === 'saved'
      ? input.messages.filter((message) => message.post.status === 'saved')
      : input.messages.filter(
          (message) =>
            input.selection.kind === 'message' &&
            message.id === input.selection.messageId,
        );
  const [first] = selected;
  if (first === undefined) return { kind: 'nothing' };
  if (first.post.status === 'posted')
    return { kind: 'already-posted', url: first.post.url };
  const runs = new Map(input.readyRuns.map((run) => [run.id, run]));
  return {
    kind: 'write',
    pullRequestNumber: input.readyRuns.at(-1)?.pullRequestNumber,
    messageIds: selected.map((message) => message.id),
    text: composeBrief(selected.map((message) => briefItem(message, runs))),
  };
}
