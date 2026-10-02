import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { apiError } from '../kit/answers.ts';
import {
  read,
  sampleReview,
  toolCall,
  toolResult,
  toolText,
  toolValue,
  worktreePath,
  answered,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text, type Session } from '../kit/session.ts';

const layerId = randomUUID();
const stepId = randomUUID();
const agentThreadId = randomUUID();
const agentMessageId = randomUUID();
const outside = apiError(
  404,
  'Not Found',
  'No registered Porcelain worktree contains this path',
);

const review = (session: Session) =>
  read(session, { method: 'GET', path: worktreePath(session, '/review') });
const threads = async (session: Session) =>
  list(
    (
      await session.read({
        method: 'GET',
        path: worktreePath(session, '/comments'),
      })
    ).body,
  );
const threadWith = (entries: unknown[], id: string) =>
  entries.filter((entry) => record(entry).id === id);

async function reviewerThread(session: Session) {
  const found = (await threads(session)).find(
    (entry) => record(list(record(entry).messages)[0]).author === 'reviewer',
  );
  return text(record(found).id);
}

test('an agent publishes the review with publish_review and a reviewer reads it over HTTP', async ({
  session,
}) => {
  const response = await session.send(
    toolCall(
      session,
      1,
      'publish_review',
      sampleReview(session, 0, layerId, stepId),
    ),
  );

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject(answered(1));
  expect(Object.keys(toolResult(response.body))).toStrictEqual(['content']);
  expect(toolValue(response.body)).toMatchObject({
    review: { revision: 1, layers: [{ id: layerId, title: 'Readme' }] },
  });
  expect(await review(session)).toMatchObject({
    review: { revision: 1, layers: [{ id: layerId, title: 'Readme' }] },
  });
});

test('an agent reads the published review with read_review as a reviewer reads it', async ({
  session,
}) => {
  const before = await review(session);

  const response = await session.send(toolCall(session, 2, 'read_review', {}));

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject(answered(2));
  const value = record(record(toolValue(response.body)).review);
  expect(value.revision).toStrictEqual(record(before.review).revision);
  expect(value.layers).toStrictEqual(record(before.review).layers);
});

test('an agent writes a thread with create_comment that a reviewer sees as the agent', async ({
  session,
}) => {
  const response = await session.send(
    toolCall(session, 3, 'create_comment', {
      threadId: agentThreadId,
      messageId: agentMessageId,
      anchor: { kind: 'file', filePath: session.fixture.readme.path },
      body: 'From the agent',
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject(answered(3));
  const written = {
    id: agentThreadId,
    resolved: false,
    messages: [{ id: agentMessageId, body: 'From the agent', author: 'agent' }],
  };
  expect(toolValue(response.body)).toMatchObject(written);
  expect(threadWith(await threads(session), agentThreadId)).toMatchObject([
    written,
  ]);
});

test('list_comments lists only the threads waiting for the agent, and every thread with scope all', async ({
  session,
}) => {
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      anchor: { kind: 'file', filePath: session.fixture.readme.path },
      body: 'From the reviewer',
    },
  });
  const threadId = await reviewerThread(session);

  const waiting = await session.send(toolCall(session, 4, 'list_comments', {}));
  const all = await session.send(
    toolCall(session, 5, 'list_comments', { scope: 'all' }),
  );

  expect(waiting.status).toBe(200);
  expect(toolValue(waiting.body)).toMatchObject([
    {
      id: threadId,
      messages: [{ body: 'From the reviewer', author: 'reviewer' }],
    },
  ]);
  expect(all.status).toBe(200);
  expect(
    list(toolValue(all.body))
      .map((entry) => text(record(entry).id))
      .sort(),
  ).toStrictEqual([agentThreadId, threadId].sort());
});

test('an agent replies with reply_to_comment as the agent and the thread stops waiting for it', async ({
  session,
}) => {
  const threadId = await reviewerThread(session);

  const response = await session.send(
    toolCall(session, 6, 'reply_to_comment', {
      threadId,
      body: 'Answered by the agent',
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject(answered(6));
  expect(toolValue(response.body)).toMatchObject({
    id: threadId,
    messages: [
      { body: 'From the reviewer', author: 'reviewer' },
      { body: 'Answered by the agent', author: 'agent' },
    ],
  });
  expect(
    toolText(
      (await session.read(toolCall(session, 7, 'list_comments', {}))).body,
    ),
  ).toBe('[]');
});

test('an agent resolves a thread with resolve_comment and a reviewer sees it resolved', async ({
  session,
}) => {
  const threadId = await reviewerThread(session);

  const response = await session.send(
    toolCall(session, 8, 'resolve_comment', { threadId, resolved: true }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject(answered(8));
  expect(toolValue(response.body)).toMatchObject({
    id: threadId,
    resolved: true,
  });
  expect(threadWith(await threads(session), threadId)).toMatchObject([
    { id: threadId, resolved: true },
  ]);
});

test('a review tool called from a directory outside every registered worktree is a not-found tool error and changes nothing', async ({
  session,
}) => {
  const before = await review(session);

  const responses = [
    await session.send(
      toolCall(session, 9, 'read_review', { cwd: session.projectHome }),
    ),
    await session.send(
      toolCall(session, 10, 'publish_review', {
        ...sampleReview(session, 1, randomUUID(), randomUUID()),
        cwd: session.projectHome,
      }),
    ),
  ];

  for (const response of responses) {
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ result: { isError: true } });
    expect(toolValue(response.body)).toStrictEqual(outside);
  }
  const after = record((await review(session)).review);
  expect(after.revision).toStrictEqual(record(before.review).revision);
  expect(after.layers).toStrictEqual(record(before.review).layers);
});
