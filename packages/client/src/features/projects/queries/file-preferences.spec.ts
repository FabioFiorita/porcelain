import { afterEach, expect, it } from 'vitest';
import { Effect, Option, Stream } from 'effect';
import { AsyncResult, AtomRegistry, Reactivity } from 'effect/reactivity';
import {
  readFilePreferences,
  setFilePreference,
} from '@porcelain/client/projects';
import {
  createWorktreeConnection,
  queryKeys,
  type RuntimeConnection,
  type Transport,
} from '@porcelain/client/transport';

const environmentId = '44444444-4444-4444-8444-444444444444';
const projectId = '55555555-5555-4555-8555-555555555555';
const owned = new Set<{
  connection: RuntimeConnection;
  registry: AtomRegistry.AtomRegistry;
}>();
afterEach(async () => {
  for (const { connection, registry } of owned) {
    registry.dispose();
    await connection.close();
  }
  owned.clear();
});
function fixture(transport: Transport) {
  const { connection } = createWorktreeConnection({
    environmentId,
    transport,
    timeoutMs: 10_000,
  });
  const registry = AtomRegistry.make();
  const subject = { connection, registry };
  owned.add(subject);
  return { ...subject, state: readFilePreferences({ connection, projectId }) };
}
function read(subject: ReturnType<typeof fixture>) {
  return Effect.runPromise(
    AtomRegistry.getResult(subject.registry, subject.state, {
      suspendOnWaiting: true,
    }),
  );
}

it('reads canonical file preferences through the project endpoint', async () => {
  const requests: string[] = [];
  const subject = fixture((path) => {
    requests.push(path);
    return Promise.resolve(
      Response.json({
        preferences: [{ path: 'README.md', hidden: true, pinned: false }],
      }),
    );
  });
  expect(await read(subject)).toEqual({
    preferences: [{ path: 'README.md', hidden: true, pinned: false }],
  });
  expect(requests).toEqual([`/api/projects/${projectId}/file-preferences`]);
});

it('a complete write response replaces an unfinished older read and survives a failed refresh', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  const saved = {
    preferences: [{ path: 'README.md', hidden: true, pinned: true }],
  };
  let reads = 0;
  const subject = fixture((_, init) => {
    if (init?.method === 'PUT') return Promise.resolve(Response.json(saved));
    reads += 1;
    if (reads === 1) {
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
    const observed = Effect.runPromise(
      AtomRegistry.toStream(subject.registry, subject.state).pipe(
        Stream.filter(
          (result) =>
            Option.getOrUndefined(AsyncResult.value(result))?.preferences[0]
              ?.pinned === true,
        ),
        Stream.take(1),
        Stream.runHead,
      ),
    );
    const command = setFilePreference({
      connection: subject.connection,
      projectId,
    });
    subject.registry.set(command, {
      path: 'README.md',
      flag: 'pinned',
      value: true,
    });
    expect(
      await Effect.runPromise(
        AtomRegistry.getResult(subject.registry, command, {
          suspendOnWaiting: true,
        }),
      ),
    ).toEqual(saved);
    expect(Option.getOrThrow(await observed)._tag).toBe('Success');
    const failed = Effect.runPromise(
      AtomRegistry.toStream(subject.registry, subject.state).pipe(
        Stream.filter(AsyncResult.isFailure),
        Stream.take(1),
        Stream.runHead,
      ),
    );
    held.resolve(Response.json({ preferences: [] }));
    expect(
      Option.getOrThrow(AsyncResult.value(Option.getOrThrow(await failed))),
    ).toEqual(saved);
    expect(reads).toBe(2);
  } finally {
    held.resolve(Response.json({ preferences: [] }));
    stop();
  }
});

it('reconnecting refreshes mounted native reads without crossing another credential connection', async () => {
  let firstReads = 0;
  let secondReads = 0;
  const first = fixture(() => {
    firstReads += 1;
    return Promise.resolve(
      Response.json({
        preferences: [
          { path: 'first.md', hidden: false, pinned: firstReads > 1 },
        ],
      }),
    );
  });
  const second = fixture(() => {
    secondReads += 1;
    return Promise.resolve(
      Response.json({
        preferences: [{ path: 'second.md', hidden: true, pinned: false }],
      }),
    );
  });
  const stopFirst = first.registry.mount(first.state);
  const stopSecond = second.registry.mount(second.state);
  try {
    expect((await read(first)).preferences[0]?.pinned).toBe(false);
    expect((await read(second)).preferences[0]?.path).toBe('second.md');
    first.connection.runtime.runSync(
      Reactivity.invalidate([queryKeys.environment(environmentId)]),
    );
    expect((await read(first)).preferences[0]?.pinned).toBe(true);
    expect((await read(second)).preferences[0]?.pinned).toBe(false);
    expect(secondReads).toBe(1);
  } finally {
    stopFirst();
    stopSecond();
  }
});
