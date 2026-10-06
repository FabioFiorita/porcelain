import { afterEach, expect, it } from 'vitest';
import { Effect, Option, Stream } from 'effect';
import { AtomRegistry, AsyncResult } from 'effect/reactivity';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { commentCommands } from './comments.ts';
import { readCommentThreads } from '@porcelain/client/reviews';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const thread = {
  id: 'bb6a4c6a-4898-426c-ac20-bf4f53fc47d7',
  worktreeId: scope.worktreeId,
  anchor: { kind: 'change' },
  resolved: false,
  revision: 1,
  messages: [
    {
      id: 'eb90812a-6a3e-464e-92ca-5c962094b867',
      body: 'Confirmed discussion',
      author: 'reviewer',
    },
  ],
};
const owned: {
  close: () => Promise<void>;
  registry: AtomRegistry.AtomRegistry;
}[] = [];
function fixture(transport: Transport) {
  const lifetime = createWorktreeConnection({
    environmentId: 'environment',
    timeoutMs: 10_000,
    transport,
  });
  const registry = AtomRegistry.make();
  const subject = {
    ...lifetime,
    registry,
    state: readCommentThreads({ scope, connection: lifetime.connection }),
    commands: commentCommands({ scope, connection: lifetime.connection }),
  };
  owned.push(subject);
  return subject;
}
afterEach(async () => {
  for (const subject of owned) {
    subject.registry.dispose();
    await subject.close();
  }
  owned.length = 0;
});
it('a refused create rejects its queued reply without sending it or changing the confirmed discussion', async () => {
  const writes: string[] = [];
  const refused = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  const subject = fixture((path, init) => {
    if (init?.method === 'POST') {
      writes.push(path);
      started.resolve();
      return refused.promise;
    }
    return Promise.resolve(Response.json([thread]));
  });
  const stop = subject.registry.mount(subject.state);
  try {
    expect(
      await Effect.runPromise(
        AtomRegistry.getResult(subject.registry, subject.state),
      ),
    ).toEqual([thread]);
    subject.registry.set(subject.commands.create, {
      anchor: { kind: 'change' },
      body: 'Please explain the change.',
    });
    subject.registry.set(subject.commands.reply, {
      threadId: thread.id,
      body: 'A dependent reply.',
      messageId: '11111111-1111-4111-8111-111111111111',
    });
    const results = Promise.allSettled([
      Effect.runPromise(
        AtomRegistry.getResult(subject.registry, subject.commands.create, {
          suspendOnWaiting: true,
        }),
      ),
      Effect.runPromise(
        AtomRegistry.getResult(subject.registry, subject.commands.reply, {
          suspendOnWaiting: true,
        }),
      ),
    ]);
    await started.promise;
    refused.resolve(
      Response.json(
        { statusCode: 403, error: 'Forbidden', message: 'Comment was refused' },
        { status: 403 },
      ),
    );
    expect(await results).toMatchObject([
      {
        status: 'rejected',
        reason: { message: 'Comment was refused', status: 403 },
      },
      {
        status: 'rejected',
        reason: {
          _tag: 'WriteNotSentError',
          message: 'An earlier change failed, so this one was not sent.',
          cause: { message: 'Comment was refused', status: 403 },
        },
      },
    ]);
    expect(writes).toEqual([`/api/worktrees/${scope.worktreeId}/comments`]);
    expect(
      Option.getOrThrow(AsyncResult.value(subject.registry.get(subject.state))),
    ).toEqual([thread]);
  } finally {
    refused.resolve(
      Response.json(
        { statusCode: 403, error: 'Forbidden', message: 'Comment was refused' },
        { status: 403 },
      ),
    );
    stop();
  }
});
it('a confirmed edit survives an unfinished older read and a failed refresh', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  const edited = {
    ...thread,
    revision: 2,
    messages: [{ ...thread.messages[0], body: 'Include the regression test.' }],
  };
  let reads = 0;
  const subject = fixture((_, init) => {
    if (init?.method === 'PATCH') return Promise.resolve(Response.json(edited));
    if (++reads === 1) {
      started.resolve();
      return held.promise;
    }
    return Promise.resolve(
      Response.json({ message: 'Refresh unavailable' }, { status: 503 }),
    );
  });
  const stop = subject.registry.mount(subject.state);
  try {
    await started.promise;
    const confirmed = Effect.runPromise(
      AtomRegistry.toStream(subject.registry, subject.state).pipe(
        Stream.filter(
          (result) =>
            Option.getOrUndefined(AsyncResult.value(result))?.[0]?.revision ===
            2,
        ),
        Stream.take(1),
        Stream.runHead,
      ),
    );
    subject.registry.set(subject.commands.edit, {
      threadId: thread.id,
      messageId: 'eb90812a-6a3e-464e-92ca-5c962094b867',
      body: 'Include the regression test.',
    });
    expect(
      await Effect.runPromise(
        AtomRegistry.getResult(subject.registry, subject.commands.edit, {
          suspendOnWaiting: true,
        }),
      ),
    ).toEqual(edited);
    expect(Option.getOrThrow(await confirmed)._tag).toBe('Success');
    held.resolve(Response.json([thread]));
    const failure = await Effect.runPromise(
      AtomRegistry.toStream(subject.registry, subject.state).pipe(
        Stream.filter(AsyncResult.isFailure),
        Stream.take(1),
        Stream.runHead,
      ),
    );
    expect(
      Option.getOrThrow(AsyncResult.value(Option.getOrThrow(failure))),
    ).toEqual([edited]);
  } finally {
    held.resolve(Response.json([thread]));
    stop();
  }
});
