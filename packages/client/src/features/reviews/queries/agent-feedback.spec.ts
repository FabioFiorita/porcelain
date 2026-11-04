import { expect, it } from 'vitest';
import { Reactivity } from 'effect/reactivity';
import {
  clientFixtures,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { agentFeedbackControls } from './agent-feedback-controls.ts';
import { readReviewAgentFeedback } from './project-reviews.ts';
import { reviewCommands } from '../commands/project-reviews.ts';

const create = clientFixtures();
const reviewId = '10000000-0000-4000-8000-000000000001';
const session = { kind: 't3', threadId: 'thread-1' };
const delivery = {
  id: '20000000-0000-4000-8000-000000000001',
  reviewId,
  reviewRevision: 2,
  commentRevision: 4,
  attempted: true,
};

it('reconciles a failed send with persisted uncertainty without retrying the host request', async () => {
  let sent = 0;
  const subject = create(async (path, init) => {
    if (path === `/api/reviews/${reviewId}`)
      return Response.json({ review: null, revision: null, revisions: [] });
    expect(path).toBe(`/api/reviews/${reviewId}/agent-feedback`);
    if (init?.method === 'POST') {
      sent += 1;
      expect(await new Response(init.body).json()).toEqual({
        reviewRevision: 2,
      });
      throw new TypeError('The response was lost');
    }
    return Response.json({
      session,
      currentCommentRevision: 4,
      ...(sent ? { delivery: { ...delivery, state: 'pending' } } : {}),
    });
  });
  const input = { connection: subject.connection, reviewId };
  const query = readReviewAgentFeedback(input);
  const stop = subject.registry.mount(query);
  try {
    expect(await readClientAtom(subject.registry, query)).toMatchObject({
      session,
    });
    const command = reviewCommands(input).sendAgentFeedback;
    subject.registry.set(command, 2);
    await expect(readClientAtom(subject.registry, command)).rejects.toThrow();
    await expect
      .poll(() => readClientAtom(subject.registry, query))
      .toMatchObject({
        session,
        delivery: { state: 'pending', attempted: true },
      });
    expect(sent).toBe(1);
  } finally {
    stop();
  }
});

it('refreshes acknowledgement on the durable review channel and connection recovery without resending', async () => {
  let state = 'delivered';
  let reads = 0;
  const subject = create(async (path, init) => {
    expect(init?.method ?? 'GET').toBe('GET');
    if (path === `/api/reviews/${reviewId}`)
      return Response.json({ review: null, revision: null, revisions: [] });
    expect(path).toBe(`/api/reviews/${reviewId}/agent-feedback`);
    reads += 1;
    return Response.json({
      session,
      currentCommentRevision: 4,
      delivery: { ...delivery, state },
    });
  });
  const query = readReviewAgentFeedback({
    connection: subject.connection,
    reviewId,
  });
  const stop = subject.registry.mount(query);
  try {
    expect(await readClientAtom(subject.registry, query)).toMatchObject({
      delivery: { state: 'delivered' },
    });
    state = 'acknowledged';
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([
        queryKeys.durableReview(subject.connection.environmentId, reviewId),
      ]),
    );
    await expect
      .poll(() => readClientAtom(subject.registry, query))
      .toMatchObject({ delivery: { state: 'acknowledged' } });
    const beforeRecovery = reads;
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([
        queryKeys.environment(subject.connection.environmentId),
      ]),
    );
    await expect.poll(() => reads).toBeGreaterThan(beforeRecovery);
    expect(await readClientAtom(subject.registry, query)).toMatchObject({
      delivery: { state: 'acknowledged' },
    });
  } finally {
    stop();
  }
});

it('disconnects the association through its dedicated review endpoint', async () => {
  const subject = create(async (path, init) => {
    expect(path).toBe(`/api/reviews/${reviewId}/agent-session`);
    expect(init?.method).toBe('DELETE');
    return Response.json({
      currentCommentRevision: 4,
    });
  });
  const command = reviewCommands({
    connection: subject.connection,
    reviewId,
  }).disconnectAgentSession;
  subject.registry.set(command, undefined);
  const result = await readClientAtom(subject.registry, command);
  expect(result.session).toBeUndefined();
  expect(result).toMatchObject({
    currentCommentRevision: 4,
  });
});

function feedbackControlFixture() {
  const requests: string[] = [];
  const writes: string[] = [];
  const subject = create(async (path, init) => {
    requests.push(path);
    if (init?.method && init.method !== 'GET') writes.push(path);
    if (path === `/api/reviews/${reviewId}`)
      return Response.json({
        review: {
          reviewId,
          projectId: 'project',
          branch: 'feature',
          state: 'open',
          latestRevision: 2,
          lastSeenRevision: 0,
        },
        revision: null,
        revisions: [],
      });
    expect(path).toBe(`/api/reviews/${reviewId}/agent-feedback`);
    return Response.json({ session, currentCommentRevision: 4 });
  });
  return { ...subject, requests, writes };
}

it.each(['send', 'disconnect'] as const)(
  'refuses direct %s dispatch from a retained read-only review',
  async (action) => {
    const subject = feedbackControlFixture();
    const controls = agentFeedbackControls({
      connection: subject.connection,
      reviewId,
      reviewRevision: 2,
      writable: false,
    });
    const stop = subject.registry.mount(controls);
    try {
      await expect
        .poll(() => subject.registry.get(controls))
        .toMatchObject({
          kind: 'ready',
          session: 'T3 · thread-1',
          canSend: false,
          canDisconnect: false,
        });
      subject.registry.set(controls, action);
      expect(subject.registry.get(controls)).toMatchObject({
        sending: false,
        disconnecting: false,
      });
      expect(subject.writes).toEqual([]);
    } finally {
      stop();
    }
  },
);

it('shares canonical reads between writable and retained controls for the same review', async () => {
  const subject = feedbackControlFixture();
  const input = { connection: subject.connection, reviewId, reviewRevision: 2 };
  const active = agentFeedbackControls({ ...input, writable: true });
  const retained = agentFeedbackControls({ ...input, writable: false });
  const stops = [
    subject.registry.mount(active),
    subject.registry.mount(retained),
  ];
  try {
    await expect
      .poll(() => subject.registry.get(active))
      .toMatchObject({ kind: 'ready', canSend: true });
    await expect
      .poll(() => subject.registry.get(retained))
      .toMatchObject({ kind: 'ready', canSend: false });
    expect(
      [...subject.requests].sort((left, right) => left.localeCompare(right)),
    ).toEqual([
      `/api/reviews/${reviewId}`,
      `/api/reviews/${reviewId}/agent-feedback`,
    ]);
  } finally {
    stops.forEach((stop) => stop());
  }
});

it.each([false, true])(
  'saves a decision request before queuing its existing feedback path, connected=%s',
  async (connected) => {
    const calls: string[] = [];
    const subject = create(async (path, init) => {
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      if (path.endsWith('/comments'))
        return Response.json({
          id: '30000000-0000-4000-8000-000000000001',
          worktreeId: 'a'.repeat(32),
          anchor: { kind: 'change' },
          resolved: false,
          messages: [
            {
              id: '30000000-0000-4000-8000-000000000002',
              body: 'Teach me this decision',
              author: 'reviewer',
            },
          ],
          revision: 1,
        });
      if (init?.method === 'POST')
        return Response.json({
          session,
          currentCommentRevision: 4,
          delivery: { ...delivery, state: 'delivered' },
        });
      return Response.json({
        ...(connected ? { session } : {}),
        currentCommentRevision: 4,
      });
    });
    const command = reviewCommands({
      connection: subject.connection,
      reviewId,
    }).requestFeedback;
    subject.registry.set(command, {
      threadId: '30000000-0000-4000-8000-000000000001',
      messageId: '30000000-0000-4000-8000-000000000002',
      body: 'Teach me this decision',
      anchor: { kind: 'change' },
      reviewRevision: 2,
    });
    expect(await readClientAtom(subject.registry, command)).toEqual({
      delivery: connected
        ? 'Feedback queued for the agent.'
        : 'No agent connected; request saved in comments.',
    });
    expect(calls).toEqual([
      `POST /api/reviews/${reviewId}/comments`,
      `GET /api/reviews/${reviewId}/agent-feedback`,
      ...(connected ? [`POST /api/reviews/${reviewId}/agent-feedback`] : []),
    ]);
  },
);
