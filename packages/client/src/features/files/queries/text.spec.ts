import { afterEach, expect, it } from 'vitest';
import { Layer, Effect, Exit } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import {
  createWorktreeConnection,
  retryWorktreeReads,
  type Transport,
} from '@porcelain/client/transport';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const owned: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of owned) await close();
  owned.length = 0;
});
function fixture(
  transport: Transport,
  cacheIdentity?: readonly string[],
  timeoutMs = 10_000,
) {
  const lifetime = createWorktreeConnection(
    {
      environmentId: 'environment',
      transport,
      timeoutMs,
      ...(cacheIdentity ? { cacheIdentity } : {}),
    },
    undefined,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  owned.push(async () => {
    registry.dispose();
    await lifetime.close();
  });
  return { ...lifetime, registry };
}
import { readTextFile } from './text.ts';
const response = {
  worktreeId: scope.worktreeId,
  path: 'README.md',
  encoding: 'utf-8',
  byteLength: 5,
  text: 'Hello',
};
function read(
  subject: ReturnType<typeof fixture>,
  path = 'README.md',
  worktree = scope,
) {
  return Effect.runPromise(
    AtomRegistry.getResult(
      subject.registry,
      readTextFile({ connection: subject.connection, scope: worktree, path }),
    ),
  );
}
it('isolates worktrees, paths and replacement credentials while sharing an active read', async () => {
  const sent: string[] = [];
  const transport: Transport = (path) => {
    sent.push(path);
    const url = new URL(path, 'http://test.invalid');
    return Promise.resolve(
      Response.json({
        ...response,
        worktreeId: url.pathname.split('/')[3],
        path: url.searchParams.get('path'),
      }),
    );
  };
  const first = fixture(transport, ['first']);
  const replacement = fixture(transport, ['replacement']);
  const query = readTextFile({
    connection: first.connection,
    scope,
    path: 'README.md',
  });
  const stop = first.registry.mount(query);
  try {
    expect(await read(first)).toMatchObject({
      path: 'README.md',
      text: 'Hello',
    });
    expect(await read(first)).toMatchObject({
      path: 'README.md',
      text: 'Hello',
    });
    expect(await read(first, 'other.md')).toMatchObject({ path: 'other.md' });
    expect(
      await read(first, 'README.md', {
        ...scope,
        worktreeId: '11111111111111111111111111111111',
      }),
    ).toMatchObject({ worktreeId: '11111111111111111111111111111111' });
    expect(await read(replacement)).toMatchObject({
      path: 'README.md',
      text: 'Hello',
    });
    expect(sent).toEqual([
      `/api/worktrees/${scope.worktreeId}/text?path=README.md`,
      `/api/worktrees/${scope.worktreeId}/text?path=other.md`,
      '/api/worktrees/11111111111111111111111111111111/text?path=README.md',
      `/api/worktrees/${scope.worktreeId}/text?path=README.md`,
    ]);
  } finally {
    stop();
  }
});
it('rejects another worktree returned by the transport', async () => {
  const subject = fixture(() =>
    Promise.resolve(
      Response.json({
        ...response,
        worktreeId: '11111111111111111111111111111111',
      }),
    ),
  );
  await expect(read(subject)).rejects.toThrow('The connected context changed.');
});
it('rejects text returned for another path', async () => {
  const subject = fixture(() =>
    Promise.resolve(
      Response.json({
        ...response,
        path: 'other.md',
      }),
    ),
  );
  await expect(read(subject)).rejects.toThrow('The connected context changed.');
});
it('encodes reserved path characters once and preserves the transport policy', async () => {
  const sent: { path: string; init: RequestInit | undefined }[] = [];
  const subject = fixture((path, init) => {
    sent.push({ path, init });
    return Promise.resolve(Response.json({ ...response, path: 'a b/#?.txt' }));
  });
  expect(await read(subject, 'a b/#?.txt')).toMatchObject({ text: 'Hello' });
  expect(sent).toHaveLength(1);
  expect(sent[0]?.path).toBe(
    `/api/worktrees/${scope.worktreeId}/text?path=a+b%2F%23%3F.txt`,
  );
  expect(sent[0]?.init).toMatchObject({
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
  });
  expect(sent[0]?.init?.signal?.aborted).toBe(false);
});
it('rejects malformed success data', async () => {
  const subject = fixture(() =>
    Promise.resolve(Response.json({ malformed: true })),
  );
  await expect(read(subject)).rejects.toThrow();
});
it('does not send a read after disconnect', async () => {
  let sent = 0;
  const subject = fixture(() => {
    sent += 1;
    return Promise.resolve(Response.json(response));
  });
  subject.controller.abort();
  await expect(read(subject)).rejects.toThrow();
  expect(sent).toBe(0);
});
it('rejects a response after disconnect even when transport ignores cancellation', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  const subject = fixture(() => {
    started.resolve();
    return held.promise;
  });
  const result = read(subject);
  const rejected = expect(result).rejects.toThrow();
  await started.promise;
  subject.controller.abort();
  held.resolve(Response.json(response));
  await rejected;
  expect(subject.controller.signal.aborted).toBe(true);
});
it('unmount cancels the active transport read', async () => {
  const started = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  const held = Promise.withResolvers<Response>();
  const subject = fixture((_, init) => {
    init?.signal?.addEventListener(
      'abort',
      () => {
        aborted.resolve();
        held.resolve(Response.json(response));
      },
      { once: true },
    );
    started.resolve();
    return held.promise;
  });
  const stop = subject.registry.mount(
    readTextFile({ connection: subject.connection, scope, path: 'README.md' }),
  );
  await started.promise;
  stop();
  await aborted.promise;
  expect(subject.controller.signal.aborted).toBe(false);
});

it('retries a failed mounted text read through its native worktree owner', async () => {
  let requests = 0;
  const subject = fixture(() => {
    requests += 1;
    return Promise.resolve(
      requests === 1
        ? new Response('Unavailable', { status: 503 })
        : Response.json(response),
    );
  });
  const atom = readTextFile({
    connection: subject.connection,
    scope,
    path: 'README.md',
  });
  const unmount = subject.registry.mount(atom);
  try {
    const refused = await Effect.runPromiseExit(
      AtomRegistry.getResult(subject.registry, atom),
    );
    expect(Exit.isFailure(refused)).toBe(true);
    expect(requests).toBe(1);
    const retry = retryWorktreeReads(subject.connection);
    subject.registry.set(retry, scope);
    await Effect.runPromise(
      AtomRegistry.getResult(subject.registry, retry, {
        suspendOnWaiting: true,
      }),
    );
    const restored = await Effect.runPromise(
      AtomRegistry.getResult(subject.registry, atom, {
        suspendOnWaiting: true,
      }),
    );
    expect(restored).toEqual(response);
    expect(requests).toBe(2);
  } finally {
    unmount();
  }
});

it('retries only the selected worktree on the selected connection', async () => {
  const requests: string[] = [];
  const transport =
    (name: string): Transport =>
    (path) => {
      requests.push(`${name}:${path}`);
      const url = new URL(path, 'http://test.invalid');
      return Promise.resolve(
        Response.json({
          ...response,
          worktreeId: url.pathname.split('/')[3],
          path: url.searchParams.get('path'),
        }),
      );
    };
  const first = fixture(transport('first'));
  const other = fixture(transport('other'));
  const otherScope = {
    ...scope,
    worktreeId: '11111111111111111111111111111111',
  };
  const selected = readTextFile({
    connection: first.connection,
    scope,
    path: 'README.md',
  });
  const sameWorkspace = readTextFile({
    connection: first.connection,
    scope,
    path: 'second.md',
  });
  const otherWorkspace = readTextFile({
    connection: first.connection,
    scope: otherScope,
    path: 'README.md',
  });
  const otherConnection = readTextFile({
    connection: other.connection,
    scope,
    path: 'README.md',
  });
  const unmount = [
    first.registry.mount(selected),
    first.registry.mount(sameWorkspace),
    first.registry.mount(otherWorkspace),
    other.registry.mount(otherConnection),
  ];
  try {
    await Promise.all([
      read(first),
      read(first, 'second.md'),
      read(first, 'README.md', otherScope),
      read(other),
    ]);
    requests.length = 0;
    const retry = retryWorktreeReads(first.connection);
    first.registry.set(retry, scope);
    await Effect.runPromise(
      AtomRegistry.getResult(first.registry, retry, { suspendOnWaiting: true }),
    );
    await Promise.all([
      read(first),
      read(first, 'second.md'),
      read(first, 'README.md', otherScope),
      read(other),
    ]);
    expect(requests.sort()).toEqual([
      `first:/api/worktrees/${scope.worktreeId}/text?path=README.md`,
      `first:/api/worktrees/${scope.worktreeId}/text?path=second.md`,
    ]);
  } finally {
    for (const stop of unmount) stop();
  }
});

it('closing a connection aborts its pending generated text transport', async () => {
  const started = Promise.withResolvers<AbortSignal>();
  const subject = fixture((_path, init) => {
    const signal = init!.signal!;
    started.resolve(signal);
    return new Promise<Response>((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      }),
    );
  });
  subject.registry.mount(
    readTextFile({ connection: subject.connection, scope, path: 'README.md' }),
  );
  const signal = await started.promise;
  await subject.connection.close();
  await expect.poll(() => signal.aborted).toBe(true);
});

it('the configured deadline aborts a pending generated text transport', async () => {
  const started = Promise.withResolvers<AbortSignal>();
  const subject = fixture(
    (_path, init) => {
      const signal = init!.signal!;
      started.resolve(signal);
      return new Promise<Response>((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        }),
      );
    },
    undefined,
    5,
  );
  subject.registry.mount(
    readTextFile({ connection: subject.connection, scope, path: 'README.md' }),
  );
  const signal = await started.promise;
  await expect.poll(() => signal.aborted).toBe(true);
  expect(subject.controller.signal.aborted).toBe(false);
});

it('one generated text deadline spans transport and pending response decoding', async () => {
  const decoding = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  let body: ReadableStreamDefaultController<Uint8Array> | undefined;
  let sentSignal: AbortSignal | null | undefined;
  let admissions = 0;
  let admissionsAtSend = 0;
  const deadline = new AbortController();
  const subject = fixture((_path, init) => {
    sentSignal = init?.signal;
    admissionsAtSend = admissions;
    return Promise.resolve(
      new Response(
        new ReadableStream<Uint8Array>(
          {
            start(controller) {
              body = controller;
            },
            pull() {
              decoding.resolve();
              return held.promise;
            },
          },
          { highWaterMark: 0 },
        ),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
  });
  const request = subject.connection.request;
  subject.connection.request = (signal) => {
    admissions += 1;
    return {
      signal: AbortSignal.any([request(signal).signal, deadline.signal]),
    };
  };
  const pending = Effect.runPromiseExit(
    AtomRegistry.getResult(
      subject.registry,
      readTextFile({
        connection: subject.connection,
        scope,
        path: 'README.md',
      }),
    ),
  );
  try {
    await decoding.promise;
    expect(admissionsAtSend).toBe(1);
    expect(admissions).toBe(1);
    deadline.abort(new Error('Request deadline elapsed'));
    expect(Exit.isFailure(await pending)).toBe(true);
    expect(sentSignal?.aborted).toBe(true);
    expect(admissions).toBe(1);
  } finally {
    body?.error(new Error('Disposed test response'));
    held.resolve();
    subject.registry.dispose();
    await subject.close();
  }
});
