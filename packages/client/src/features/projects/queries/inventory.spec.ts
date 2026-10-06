import { afterEach, describe, expect, it } from 'vitest';
import { Cause, Effect, Exit, Layer, Option, Stream } from 'effect';
import { InventorySeed, registerProject } from '@porcelain/client/projects';
import { AsyncResult, AtomRegistry, Reactivity } from 'effect/reactivity';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import {
  createWorktreeConnection,
  queryKeys,
  type RuntimeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { readInventory } from './inventory.ts';

const environmentId = '87deba35-c65b-4fb6-9dfd-52bfbe76f64c';
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
function inventory(
  name = 'Computer',
  identity = environmentId,
): ReadInventoryResponse {
  return {
    environmentId: identity,
    environment: { name, custom: true },
    projects: [],
  };
}
function fixture(transport: Transport, cacheIdentity?: readonly string[]) {
  const lifetime = createWorktreeConnection({
    environmentId,
    transport,
    timeoutMs: 10_000,
    ...(cacheIdentity ? { cacheIdentity } : {}),
  });
  const registry = AtomRegistry.make();
  owned.add({ connection: lifetime.connection, registry });
  return { ...lifetime, registry };
}
function read(subject: ReturnType<typeof fixture>) {
  return Effect.runPromise(
    AtomRegistry.getResult(
      subject.registry,
      readInventory(subject.connection),
      { suspendOnWaiting: true },
    ),
  );
}
describe('reading a connected project inventory', () => {
  it('reads the canonical HTTP endpoint through its connection', async () => {
    const requests: string[] = [];
    const subject = fixture((path) => {
      requests.push(path);
      return Promise.resolve(Response.json(inventory()));
    });
    expect(await read(subject)).toEqual(inventory());
    expect(requests).toEqual(['/api/inventory']);
  });
  it('rejects an inventory returned by another installation', async () => {
    const subject = fixture(() =>
      Promise.resolve(
        Response.json(
          inventory('Other computer', '7978b5bd-7a5e-49c2-b624-068b2a257fc2'),
        ),
      ),
    );
    await expect(read(subject)).rejects.toThrow(
      'The connected context changed.',
    );
  });
  it('rejects a completed read when its connection was cancelled', async () => {
    let requests = 0;
    const subject = fixture(() => {
      requests += 1;
      subject.controller.abort();
      return Promise.resolve(Response.json(inventory()));
    });
    const answer = await Effect.runPromiseExit(
      AtomRegistry.getResult(
        subject.registry,
        readInventory(subject.connection),
        { suspendOnWaiting: true },
      ),
    );
    expect(Exit.isFailure(answer)).toBe(true);
    if (Exit.isFailure(answer))
      expect(Cause.hasInterrupts(answer.cause)).toBe(true);
    const result = subject.registry.get(readInventory(subject.connection));
    expect(AsyncResult.isFailure(result)).toBe(true);
    expect(result.waiting).toBe(false);
    expect(Option.getOrUndefined(AsyncResult.value(result))).toBeUndefined();
    expect(requests).toBe(1);
  });
  it('settles a cancelled refresh without replacing its confirmed inventory', async () => {
    const held = Promise.withResolvers<Response>();
    const started = Promise.withResolvers<void>();
    let requests = 0;
    const subject = fixture(() => {
      requests += 1;
      if (requests === 1)
        return Promise.resolve(Response.json(inventory('Confirmed computer')));
      started.resolve();
      return held.promise;
    });
    const state = readInventory(subject.connection);
    const stop = subject.registry.mount(state);
    try {
      expect(await read(subject)).toEqual(inventory('Confirmed computer'));
      subject.registry.refresh(state);
      await started.promise;
      const interrupted = Effect.runPromiseExit(
        AtomRegistry.getResult(subject.registry, state, {
          suspendOnWaiting: true,
        }),
      );
      subject.controller.abort();
      held.resolve(Response.json(inventory('Late computer')));
      const answer = await interrupted;
      expect(Exit.isFailure(answer)).toBe(true);
      if (Exit.isFailure(answer))
        expect(Cause.hasInterrupts(answer.cause)).toBe(true);
      const result = subject.registry.get(state);
      expect(AsyncResult.isFailure(result)).toBe(true);
      expect(result.waiting).toBe(false);
      expect(Option.getOrThrow(AsyncResult.value(result))).toEqual(
        inventory('Confirmed computer'),
      );
      expect(requests).toBe(2);
    } finally {
      held.resolve(Response.json(inventory('Late computer')));
      stop();
    }
  });
  it('unmounting the read cancels its HTTP request without closing the connection', async () => {
    const started = Promise.withResolvers<void>();
    const cancelled = Promise.withResolvers<void>();
    let signal: AbortSignal | null | undefined;
    const subject = fixture((_path, init) => {
      signal = init?.signal;
      signal?.addEventListener('abort', () => cancelled.resolve(), {
        once: true,
      });
      started.resolve();
      return new Promise(() => {});
    });
    const unmount = subject.registry.mount(readInventory(subject.connection));
    await started.promise;
    unmount();
    await cancelled.promise;
    expect(signal?.aborted).toBe(true);
    expect(subject.controller.signal.aborted).toBe(false);
  });
  it('isolates devices on the same environment, including their reactive refreshes', async () => {
    let firstReads = 0;
    let secondReads = 0;
    const first = fixture(() => {
      firstReads += 1;
      return Promise.resolve(Response.json(inventory(`First ${firstReads}`)));
    }, ['https://computer.test', 'first-device']);
    const second = fixture(() => {
      secondReads += 1;
      return Promise.resolve(Response.json(inventory(`Second ${secondReads}`)));
    }, ['https://computer.test', 'second-device']);
    const stopFirst = first.registry.mount(readInventory(first.connection));
    const stopSecond = second.registry.mount(readInventory(second.connection));
    try {
      expect((await read(first)).environment.name).toBe('First 1');
      expect((await read(second)).environment.name).toBe('Second 1');
      first.connection.runtime.runSync(
        Reactivity.invalidate([queryKeys.inventory(environmentId)]),
      );
      expect((await read(first)).environment.name).toBe('First 2');
      expect((await read(second)).environment.name).toBe('Second 1');
      expect(secondReads).toBe(1);
    } finally {
      stopFirst();
      stopSecond();
    }
  });
});

it('a read started before a confirmed write cannot restore its old inventory, even when the following refresh fails', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  let reads = 0;
  const added = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Added project',
    available: true,
    worktrees: [],
  };
  const subject = fixture((path) => {
    if (path === '/api/projects') return Promise.resolve(Response.json(added));
    reads += 1;
    if (reads === 1) {
      started.resolve();
      return held.promise;
    }
    return Promise.resolve(
      Response.json({ message: 'Refresh unavailable' }, { status: 503 }),
    );
  });
  subject.connection.atoms.addGlobalLayer(
    Layer.succeed(InventorySeed, Option.some(inventory())),
  );
  const state = readInventory(subject.connection);
  const stop = subject.registry.mount(state);
  try {
    await started.promise;
    const confirmed = Effect.runPromise(
      AtomRegistry.toStream(subject.registry, state).pipe(
        Stream.filter(
          (result) =>
            Option.getOrUndefined(AsyncResult.value(result))?.projects[0]
              ?.name === 'Added project',
        ),
        Stream.take(1),
        Stream.runHead,
      ),
    );
    const command = registerProject(subject.connection);
    subject.registry.set(command, '/repository');
    expect(
      await Effect.runPromise(
        AtomRegistry.getResult(subject.registry, command, {
          suspendOnWaiting: true,
        }),
      ),
    ).toEqual(added);
    expect(Option.getOrThrow(await confirmed)._tag).toBe('Success');
    const failed = Effect.runPromise(
      AtomRegistry.toStream(subject.registry, state).pipe(
        Stream.filter(AsyncResult.isFailure),
        Stream.take(1),
        Stream.runHead,
      ),
    );
    held.resolve(Response.json(inventory()));
    const result = Option.getOrThrow(await failed);
    expect(Option.getOrThrow(AsyncResult.value(result)).projects).toEqual([
      added,
    ]);
    expect(reads).toBe(2);
  } finally {
    held.resolve(Response.json(inventory()));
    stop();
  }
});
