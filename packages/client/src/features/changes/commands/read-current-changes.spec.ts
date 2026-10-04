import { expect, it, onTestFinished } from 'vitest';
import {
  CancelledError,
  QueryClient,
  QueryObserver,
} from '@tanstack/query-core';
import { readChangesResponseSchema } from '@porcelain/contracts/changes';
import {
  changesQueryOptions,
  changesStore,
  recoverChangedDiffs,
} from '@porcelain/client/changes';
import { readCurrentChanges } from './read-current-changes.ts';

const scope = {
  projectId: 'a1000000-0000-4000-8000-000000000002',
  worktreeId: 'abcd1234abcd1234abcd1234abcd1234',
};
const environmentId = 'a1000000-0000-4000-8000-000000000001';
const A = readChangesResponseSchema.parse({
  environmentId,
  worktreeId: scope.worktreeId,
  statusToken: 'a'.repeat(64),
  headOid: null,
  inProgress: null,
  mergeHeadOid: null,
  branch: null,
  changes: [
    {
      path: 'README.md',
      fingerprint: 'c'.repeat(64),
      comparisons: [{ scope: 'untracked', path: 'README.md' }],
    },
  ],
});
const B = {
  ...A,
  statusToken: 'b'.repeat(64),
  changes: [{ ...A.changes[0]!, fingerprint: 'd'.repeat(64) }],
};

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Value>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup() {
  const controller = new AbortController();
  const requests: { path: string; signal: AbortSignal }[] = [];
  const gates = Array.from({ length: 3 }, () => ({
    started: deferred<void>(),
    response: deferred<Response>(),
  }));
  const connection: Parameters<typeof readCurrentChanges>[1] = {
    environmentId,
    request: (signal) => ({
      signal: AbortSignal.any([controller.signal, signal!]),
    }),
    transport: (path, init) => {
      const signal = init!.signal!;
      const gate = gates[requests.length]!;
      expect(init!.method).toBe('GET');
      expect(path).toBe(
        '/api/worktrees/abcd1234abcd1234abcd1234abcd1234/changes',
      );
      requests.push({ path, signal });
      const abort = () => gate.response.reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      gate.started.resolve();
      return gate.response.promise.finally(() =>
        signal.removeEventListener('abort', abort),
      );
    },
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const options = changesQueryOptions(scope, connection);
  client.setQueryData(options.queryKey, { changes: A });
  const observer = new QueryObserver(client, {
    ...options,
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => {});
  const prior = changesStore.getState();
  changesStore.setState({ attempted: {}, pending: {} });
  onTestFinished(async () => {
    unsubscribe();
    observer.destroy();
    await client.cancelQueries();
    client.clear();
    changesStore.setState(prior, true);
    expect(client.getQueryCache().getAll()).toEqual([]);
    expect(client.getQueryCache().hasListeners()).toBe(false);
  });
  return {
    client,
    connection,
    controller,
    observer,
    options,
    requests,
    gates,
    start: async () => {
      const active = observer.refetch({ cancelRefetch: false });
      await gates[0]!.started.promise;
      return { active };
    },
    send: (index: number, value = B) =>
      gates[index]!.response.resolve(
        Response.json(readChangesResponseSchema.encode(value)),
      ),
    read: () => readCurrentChanges(scope, connection, client),
    cached: () => client.getQueryData(options.queryKey),
  };
}

it('joins one active read and returns its fresh status and fingerprint', async () => {
  const kit = setup();
  const { active } = await kit.start();
  const read = kit.read();
  expect(kit.requests).toHaveLength(1);
  kit.send(0);
  expect(await read).toEqual(B);
  expect((await active).data).toEqual({ changes: B });
  expect(kit.requests[0]!.signal.aborted).toBe(false);
  expect(kit.client.getQueryCache().hasListeners()).toBe(false);
});

it('starts a fresh read instead of returning the settled cached snapshot', async () => {
  const kit = setup();
  const read = kit.read();
  await kit.gates[0]!.started.promise;
  expect(kit.cached()).toEqual({ changes: A });
  kit.send(0);
  expect(await read).toEqual(B);
  expect(kit.requests).toHaveLength(1);
});

it('lets concurrent deliberate readers share one fresh answer and clean up independently', async () => {
  const kit = setup();
  const { active } = await kit.start();
  const first = kit.read();
  const second = kit.read();
  kit.send(0);
  expect(await Promise.all([first, second])).toEqual([B, B]);
  await active;
  expect(kit.requests).toHaveLength(1);
  expect(kit.client.getQueryCache().hasListeners()).toBe(false);
});

it.each(['initial', 'replacement'])(
  'returns fetched B when an earlier subscriber writes cached A during %s success',
  async (kind) => {
    const kit = setup();
    const { active } = await kit.start();
    const query = kit.client
      .getQueryCache()
      .find({ queryKey: kit.options.queryKey });
    let writes = 0;
    const unsubscribe = kit.client.getQueryCache().subscribe((event) => {
      if (
        event.query === query &&
        event.type === 'updated' &&
        event.action.type === 'success' &&
        !event.action.manual
      ) {
        writes++;
        kit.client.setQueryData(kit.options.queryKey, { changes: A });
      }
    });
    try {
      const read = kit.read();
      const recovery =
        kind === 'replacement'
          ? recoverChangedDiffs(
              scope,
              kit.connection,
              kit.client,
              A.statusToken,
            )
          : undefined;
      const index = kind === 'replacement' ? 1 : 0;
      await kit.gates[index]!.started.promise;
      kit.send(index);
      expect(await read).toEqual(B);
      await Promise.all([active, recovery]);
      expect(writes).toBe(1);
      expect(kit.cached()).toEqual({ changes: A });
      expect(kit.requests).toHaveLength(index + 1);
    } finally {
      unsubscribe();
    }
  },
);

it('returns the actual recovery replacement instead of its cancelled joined promise or cached snapshot', async () => {
  const kit = setup();
  const { active } = await kit.start();
  const read = kit.read();
  const recovery = recoverChangedDiffs(
    scope,
    kit.connection,
    kit.client,
    A.statusToken,
  );
  await kit.gates[1]!.started.promise;
  expect(kit.cached()).toEqual({ changes: A });
  expect(kit.requests[0]!.signal.aborted).toBe(true);
  kit.send(1);
  expect(await read).toEqual(B);
  expect((await active).data).toEqual({ changes: B });
  await recovery;
  expect(kit.requests).toHaveLength(2);
  expect(kit.requests[1]!.signal.aborted).toBe(false);
  expect(kit.cached()).toEqual({ changes: B });
});

it('retains a replacement completion even after its public promise is cleared', async () => {
  const kit = setup();
  const { active } = await kit.start();
  const read = kit.read();
  const recovery = recoverChangedDiffs(
    scope,
    kit.connection,
    kit.client,
    A.statusToken,
  );
  await kit.gates[1]!.started.promise;
  kit.send(1);
  await recovery;
  expect(
    kit.client.getQueryCache().find({ queryKey: kit.options.queryKey })!
      .promise,
  ).toBeUndefined();
  expect(await read).toEqual(B);
  await active;
  expect(kit.requests).toHaveLength(2);
});

it('propagates a replacement transport error without accepting the old cache or issuing another request', async () => {
  const kit = setup();
  const { active } = await kit.start();
  const read = kit.read();
  const failure = expect(read).rejects.toMatchObject({
    name: 'ConnectionError',
    cause: new Error('Replacement unavailable'),
  });
  const recovery = recoverChangedDiffs(
    scope,
    kit.connection,
    kit.client,
    A.statusToken,
  );
  await kit.gates[1]!.started.promise;
  kit.gates[1]!.response.reject(new Error('Replacement unavailable'));
  await failure;
  await recovery;
  await active;
  expect(kit.cached()).toEqual({ changes: A });
  expect(kit.requests).toHaveLength(2);
});

it.each([false, true])(
  'rejects explicit cancellation (silent=%s) without treating reverted cache as fresh',
  async (silent) => {
    const kit = setup();
    const { active } = await kit.start();
    const read = kit.read();
    const failure = expect(read).rejects.toBeInstanceOf(CancelledError);
    await kit.client.cancelQueries(
      { queryKey: kit.options.queryKey },
      { silent },
    );
    await failure;
    await active;
    expect(kit.cached()).toEqual({ changes: A });
    expect(kit.requests).toHaveLength(1);
  },
);

it('rejects explicit cancellation even if another read immediately starts on the same query', async () => {
  const kit = setup();
  const { active } = await kit.start();
  const read = kit.read();
  const failure = expect(read).rejects.toBeInstanceOf(CancelledError);
  const cancellation = kit.client.cancelQueries(
    { queryKey: kit.options.queryKey },
    { silent: true },
  );
  const other = kit.client.query({ ...kit.options, staleTime: 0 });
  await kit.gates[1]!.started.promise;
  kit.send(1);
  await failure;
  expect(await other).toEqual({ changes: B });
  await Promise.all([active, cancellation]);
  expect(kit.requests).toHaveLength(2);
});

it('rejects removal and cannot adopt a different query with the same key', async () => {
  const kit = setup();
  const { active } = await kit.start();
  const read = kit.read();
  const failure = expect(read).rejects.toBeInstanceOf(CancelledError);
  const original = kit.client
    .getQueryCache()
    .find({ queryKey: kit.options.queryKey });
  kit.client.removeQueries({ queryKey: kit.options.queryKey });
  const other = kit.client.query({ ...kit.options, staleTime: 0 });
  await kit.gates[1]!.started.promise;
  kit.send(1);
  await failure;
  expect(await other).toEqual({ changes: B });
  await active;
  expect(
    kit.client.getQueryCache().find({ queryKey: kit.options.queryKey }),
  ).not.toBe(original);
  expect(kit.requests).toHaveLength(2);
});

it('rejects a disconnected connection rather than returning its cached answer', async () => {
  const kit = setup();
  const { active } = await kit.start();
  const read = kit.read();
  const failure = expect(read).rejects.toMatchObject({ name: 'AbortError' });
  kit.controller.abort(new DOMException('Disconnected', 'AbortError'));
  await failure;
  await active;
  expect(kit.cached()).toEqual({ changes: A });
  expect(kit.requests).toHaveLength(1);
});

it('rejects unauthorized responses instead of accepting a cached snapshot', async () => {
  const kit = setup();
  const { active } = await kit.start();
  const read = kit.read();
  const failure = expect(read).rejects.toMatchObject({
    name: 'RequestError',
    status: 401,
  });
  kit.gates[0]!.response.resolve(
    Response.json({ message: 'Unauthorized' }, { status: 401 }),
  );
  await failure;
  await active;
  expect(kit.cached()).toEqual({ changes: A });
  expect(kit.requests).toHaveLength(1);
});

it('rejects an answer from a different worktree even when the replacement completes', async () => {
  const kit = setup();
  const { active } = await kit.start();
  const read = kit.read();
  const failure = expect(read).rejects.toMatchObject({
    name: 'ConnectionError',
    message:
      'The connected context changed. Reopen Porcelain to continue safely.',
  });
  const recovery = recoverChangedDiffs(
    scope,
    kit.connection,
    kit.client,
    A.statusToken,
  );
  await kit.gates[1]!.started.promise;
  kit.send(1, { ...B, worktreeId: '11111111111111111111111111111111' });
  await failure;
  await recovery;
  await active;
  expect(kit.cached()).toEqual({ changes: A });
  expect(kit.requests).toHaveLength(2);
});

it('follows repeated same-query replacements and ignores a manual cache write', async () => {
  const kit = setup();
  const { active } = await kit.start();
  const read = kit.read();
  const first = recoverChangedDiffs(
    scope,
    kit.connection,
    kit.client,
    A.statusToken,
  );
  await kit.gates[1]!.started.promise;
  kit.client.setQueryData(kit.options.queryKey, { changes: B });
  const second = recoverChangedDiffs(
    scope,
    kit.connection,
    kit.client,
    B.statusToken,
  );
  await kit.gates[2]!.started.promise;
  let completed = false;
  void read.then(() => {
    completed = true;
  });
  await Promise.resolve();
  expect(completed).toBe(false);
  kit.send(2);
  expect(await read).toEqual(B);
  await Promise.all([active, first, second]);
  expect(kit.requests.map((request) => request.signal.aborted)).toEqual([
    true,
    true,
    false,
  ]);
  expect(kit.requests).toHaveLength(3);
});
