import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { apiError } from '../kit/answers.ts';
import type { ServerHandle } from '../kit/isolated-server.ts';
import {
  commitReviewFixture,
  pairDevice,
  read,
  sampleReview,
  toolCall,
  toolValue,
  worktreePath,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  text,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

const REGISTRATION_PATH = '/api/push-registration';
const APP = 'http://app.example';

const fromDevice = (credential: string) => ({
  auth: { bearer: credential },
  headers: { origin: APP },
});
const register = (
  credential: string,
  token: string,
  kinds: readonly string[],
): HttpRequest => ({
  method: 'PUT',
  path: REGISTRATION_PATH,
  body: { token, platform: 'android', kinds },
  ...fromDevice(credential),
});
const unregister = (credential: string): HttpRequest => ({
  method: 'DELETE',
  path: REGISTRATION_PATH,
  ...fromDevice(credential),
});

async function pushRequestsAfter(
  server: ServerHandle,
  seen: number,
  count: number,
) {
  await expect
    .poll(async () => (await server.pushRequests()).length)
    .toBeGreaterThanOrEqual(seen + count);
  return (await server.pushRequests()).slice(seen).map(record);
}

async function projectName(session: Session) {
  const inventory = await read(session, {
    method: 'GET',
    path: '/api/inventory',
  });
  return text(record(list(inventory.projects)[0]).name);
}

async function publish(session: Session, id: number) {
  const current = record(
    await read(session, {
      method: 'GET',
      path: worktreePath(session, '/review'),
    }),
  ).review;
  const revision =
    current === undefined || current === null
      ? 0
      : Number(record(current).revision);
  const published = await read(
    session,
    toolCall(
      session,
      id,
      'publish_review',
      sampleReview(session, revision, randomUUID(), randomUUID()),
    ),
  );
  const value = record(toolValue(published));
  return { reviewId: text(value.reviewId), app: text(record(value.links).app) };
}

test("registered phones hear about a published review and an agent reply, not the developer's own reply, and stop once they unregister", async ({
  session,
  server,
}) => {
  const phone = await pairDevice(session, 'Phone');
  const tablet = await pairDevice(session, 'Tablet');
  const phoneToken = 'ExponentPushToken[phone]';
  const tabletToken = 'ExponentPushToken[tablet]';
  const registered = await session.send(
    register(phone.credential, phoneToken, ['agent-reply', 'review-ready']),
  );
  await read(
    session,
    register(tablet.credential, tabletToken, ['agent-reply']),
  );
  const project = await projectName(session);
  await commitReviewFixture(session);
  const seen = (await server.pushRequests()).length;

  const review = await publish(session, 1);
  const [published] = await pushRequestsAfter(server, seen, 1);

  expect(registered.status).toBe(200);
  expect(registered.body).toStrictEqual({
    kinds: ['review-ready', 'agent-reply'],
  });
  expect(review.app).toContain(`/open/reviews/${review.reviewId}?`);
  expect(published).toStrictEqual({
    method: 'POST',
    path: '/--/api/v2/push/send',
    messages: [
      {
        to: phoneToken,
        title: project,
        body: 'Review ready: Verify the disposable README review',
        data: { kind: 'review-ready', url: review.app },
        sound: 'default',
        channelId: 'reviews',
      },
    ],
  });

  const threadId = randomUUID();
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      threadId,
      reviewId: review.reviewId,
      anchor: { kind: 'file', filePath: 'README.md' },
      body: 'Why this line?',
    },
  });
  const afterPublish = (await server.pushRequests()).length;
  await read(
    session,
    toolCall(session, 2, 'reply_to_comment', {
      threadId,
      reviewId: review.reviewId,
      body: 'It names the new section.\n```sh\nexport TOKEN=abc\n```',
    }),
  );
  const [replied] = await pushRequestsAfter(server, afterPublish, 1);

  const reply = {
    title: project,
    body: 'Agent replied: It names the new section.',
    data: { kind: 'agent-reply', url: review.app },
    sound: 'default',
    channelId: 'reviews',
  };
  expect(
    list(replied?.messages).toSorted((a, b) =>
      text(record(a).to).localeCompare(text(record(b).to)),
    ),
  ).toStrictEqual([
    { to: phoneToken, ...reply },
    { to: tabletToken, ...reply },
  ]);

  const cleared = await session.send(unregister(phone.credential));
  const emptied = await session.send(
    register(tablet.credential, tabletToken, []),
  );
  const watcher = await pairDevice(session, 'Watcher');
  const watcherToken = 'ExponentPushToken[watcher]';
  await read(
    session,
    register(watcher.credential, watcherToken, ['agent-reply']),
  );
  const beforeQuiet = (await server.pushRequests()).length;
  await publish(session, 3);
  await read(session, {
    method: 'POST',
    path: `/api/reviews/${review.reviewId}/comments/${threadId}/replies`,
    body: { body: 'Thanks, one more change?' },
  });
  await read(
    session,
    toolCall(session, 4, 'reply_to_comment', {
      threadId,
      reviewId: review.reviewId,
      body: 'Done.',
    }),
  );
  const quiet = await pushRequestsAfter(server, beforeQuiet, 1);

  expect(cleared.status).toBe(204);
  expect(emptied.status).toBe(200);
  expect(emptied.body).toStrictEqual({ kinds: [] });
  expect(quiet).toHaveLength(1);
  expect(
    list(quiet[0]?.messages).map((message) => record(message).to),
  ).toStrictEqual([watcherToken]);
});

test('a token Expo no longer knows is dropped after the first send', async ({
  session,
  server,
}) => {
  const phone = await pairDevice(session, 'Forgotten phone');
  const watcher = await pairDevice(session, 'Second watcher');
  const forgotten = 'ExponentPushToken[Unregistered-phone]';
  const watcherToken = 'ExponentPushToken[second-watcher]';
  await read(session, register(phone.credential, forgotten, ['review-ready']));
  await commitReviewFixture(session);
  const seen = (await server.pushRequests()).length;
  await publish(session, 5);
  const [first] = await pushRequestsAfter(server, seen, 1);
  await read(
    session,
    register(watcher.credential, watcherToken, ['review-ready']),
  );
  const afterFirst = (await server.pushRequests()).length;
  await publish(session, 6);
  const [second] = await pushRequestsAfter(server, afterFirst, 1);

  expect(
    list(first?.messages).map((message) => record(message).to),
  ).toStrictEqual([forgotten]);
  expect(
    list(second?.messages).map((message) => record(message).to),
  ).toStrictEqual([watcherToken]);
});

test('the desktop app cannot register for phone notifications', async ({
  session,
}) => {
  const response = await session.send({
    method: 'PUT',
    path: REGISTRATION_PATH,
    auth: 'desktop',
    body: {
      token: 'ExponentPushToken[desktop]',
      platform: 'ios',
      kinds: ['review-ready'],
    },
  });

  expect(response.status).toBe(403);
  expect(response.body).toStrictEqual(
    apiError(
      403,
      'Forbidden',
      'Notifications are registered by a paired device',
    ),
  );
});

test('an agent reply to the developer outside a review names the project and opens no review, and a reply on its own thread sends nothing', async ({
  session,
  server,
}) => {
  const phone = await pairDevice(session, 'Worktree phone');
  const token = 'ExponentPushToken[worktree-phone]';
  await read(session, register(phone.credential, token, ['agent-reply']));
  const threadId = randomUUID();
  const agentThreadId = randomUUID();
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      threadId,
      anchor: { kind: 'file', filePath: 'README.md' },
      body: 'Is this file still needed?',
    },
  });
  await read(
    session,
    toolCall(session, 8, 'create_comment', {
      threadId: agentThreadId,
      anchor: { kind: 'file', filePath: 'README.md' },
      body: 'Note for myself',
    }),
  );
  const seen = (await server.pushRequests()).length;
  await read(
    session,
    toolCall(session, 9, 'reply_to_comment', {
      threadId: agentThreadId,
      body: 'Still a note for myself',
    }),
  );
  await read(
    session,
    toolCall(session, 7, 'reply_to_comment', {
      threadId,
      body: 'Yes, the installer reads it.',
    }),
  );
  const [replied] = await pushRequestsAfter(server, seen, 1);

  expect(
    list(replied?.messages).filter((message) => record(message).to === token),
  ).toStrictEqual([
    {
      to: token,
      title: await projectName(session),
      body: 'Agent replied: Yes, the installer reads it.',
      data: { kind: 'agent-reply' },
      sound: 'default',
      channelId: 'reviews',
    },
  ]);
});

test('publishing returns while the push service has not answered, before the send gives up', async ({
  session,
  server,
}) => {
  const phone = await pairDevice(session, 'Slow phone');
  await read(
    session,
    register(phone.credential, 'ExponentPushToken[Unanswered-phone]', [
      'review-ready',
    ]),
  );
  await commitReviewFixture(session);
  const seen = (await server.pushRequests()).length;
  const review = await publish(session, 10);
  const [pending] = await pushRequestsAfter(server, seen, 1);
  const whilePending = (await server.pushRequests()).slice(seen);
  const cleared = await session.send(unregister(phone.credential));
  await expect
    .poll(async () => (await server.pushRequests()).slice(seen).map(record), {
      timeout: 30_000,
    })
    .toContainEqual({ abandoned: true });

  expect(review.reviewId).not.toBe('');
  expect(whilePending).toHaveLength(1);
  expect(
    list(pending?.messages).map((message) => record(message).to),
  ).toContain('ExponentPushToken[Unanswered-phone]');
  expect(cleared.status).toBe(204);
});
