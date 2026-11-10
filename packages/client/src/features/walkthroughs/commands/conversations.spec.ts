import type { WalkthroughConversationsResponse } from '@porcelain/contracts/walkthroughs';
import {
  readWalkthroughConversations,
  walkthroughConversationCommands,
} from '@porcelain/client/walkthroughs';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { Effect, Layer } from 'effect';
import { AtomRegistry, type Atom, type AsyncResult } from 'effect/reactivity';
import { expect, it, onTestFinished } from 'vitest';

const scope = { projectId: 'project', worktreeId: 'f'.repeat(32) };
const route = `/api/worktrees/${scope.worktreeId}/walkthrough/run/conversations`;
const conversations = (messageIds: readonly string[]) =>
  ({
    runId: 'run',
    pullRequestNumber: null,
    conversations: messageIds.map((id) => ({
      runId: 'run',
      anchor: { kind: 'walkthrough' },
      messages: [
        {
          author: 'developer',
          id,
          text: `Message ${id}`,
          createdAt: '2026-11-09T00:00:00.000Z',
          post: { status: 'none' },
        },
        {
          author: 'agent',
          id: `${id}:answer`,
          replyTo: id,
          createdAt: '2026-11-09T00:00:00.000Z',
          state: { status: 'answering' },
        },
      ],
    })),
  }) satisfies Omit<WalkthroughConversationsResponse, 'pullRequestNumber'> & {
    pullRequestNumber: null;
  };

function fixture(transport: Transport) {
  const lifetime = createWorktreeConnection(
    { environmentId: 'environment', timeoutMs: 10_000, transport },
    undefined,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  onTestFinished(async () => {
    registry.dispose();
    await lifetime.close();
  });
  const selection = { connection: lifetime.connection, scope, runId: 'run' };
  const read = <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) =>
    Effect.runPromise(
      AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
    );
  const send = <Input, A, E>(
    command: Atom.AtomResultFn<Input, A, E>,
    input: Input,
  ) => {
    registry.set(command, input);
    return read(command);
  };
  return {
    registry,
    selection,
    read,
    send,
    state: readWalkthroughConversations(selection),
    commands: walkthroughConversationCommands(selection),
  };
}
it('sends each command to its route and refreshes the conversations afterwards', async () => {
  const calls: string[] = [];
  let current: readonly string[] = [];
  const subject = fixture((path, init) => {
    const pathname = new URL(path, 'http://porcelain.test').pathname;
    calls.push(`${init?.method ?? 'GET'} ${pathname}`);
    if (init?.method === 'POST' && pathname === `${route}/messages`)
      current = ['added'];
    if (pathname.endsWith('/post') || pathname.endsWith('/post-saved'))
      return Promise.resolve(
        Response.json({
          outcome: { status: 'brief', text: 'Brief to copy' },
          view: conversations(current),
        }),
      );
    if (pathname.endsWith('/brief'))
      return Promise.resolve(Response.json({ text: 'Brief to copy' }));
    return Promise.resolve(Response.json(conversations(current)));
  });
  const stop = subject.registry.mount(subject.state);
  onTestFinished(stop);
  expect((await subject.read(subject.state)).conversations).toEqual([]);
  await subject.send(subject.commands.addMessage, {
    anchor: { kind: 'walkthrough' },
    text: 'Why?',
  });
  await expect
    .poll(async () => (await subject.read(subject.state)).conversations.length)
    .toBe(1);
  await subject.send(subject.commands.saveMessage, {
    messageId: 'added',
    saved: true,
  });
  await subject.send(subject.commands.retryAnswer, 'added');
  const posted = await subject.send(subject.commands.postMessage, 'added');
  expect(posted.outcome).toEqual({ status: 'brief', text: 'Brief to copy' });
  const saved = await subject.send(
    subject.commands.postSavedMessages,
    undefined,
  );
  expect(saved.outcome).toEqual({ status: 'brief', text: 'Brief to copy' });
  expect(await subject.send(subject.commands.readBrief, 'added')).toBe(
    'Brief to copy',
  );
  expect(calls).toEqual(
    expect.arrayContaining([
      `GET ${route}`,
      `POST ${route}/messages`,
      `PUT ${route}/messages/added/saved`,
      `POST ${route}/messages/added/retry`,
      `POST ${route}/messages/added/post`,
      `POST ${route}/post-saved`,
      `GET ${route}/brief`,
    ]),
  );
});

it('loads separate conversation snapshots for the displayed runs of two branches in one worktree', async () => {
  const subject = fixture((path) => {
    const runId = new URL(path, 'http://porcelain.test').pathname.includes(
      '/walkthrough/a/',
    )
      ? 'a'
      : 'b';
    return Promise.resolve(
      Response.json({ ...conversations([`comment-${runId}`]), runId }),
    );
  });
  const a = readWalkthroughConversations({ ...subject.selection, runId: 'a' });
  const b = readWalkthroughConversations({ ...subject.selection, runId: 'b' });
  onTestFinished(subject.registry.mount(a));
  onTestFinished(subject.registry.mount(b));
  expect((await subject.read(a)).conversations[0]?.messages[0]?.id).toBe(
    'comment-a',
  );
  expect((await subject.read(b)).conversations[0]?.messages[0]?.id).toBe(
    'comment-b',
  );
});
