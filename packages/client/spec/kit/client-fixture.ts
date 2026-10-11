import { afterEach } from 'vitest';
import { Effect, Layer } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { createWorktreeConnection } from '../../src/shared/api/worktree-connection.ts';
import type { Transport } from '../../src/shared/api/transport.ts';

export function createClientFixture(
  options: Parameters<typeof createWorktreeConnection>[0],
  layer = Layer.empty,
) {
  const lifetime = createWorktreeConnection(options, undefined, layer);
  const registry = AtomRegistry.make();
  return {
    ...lifetime,
    registry,
    cleanup: async () => {
      registry.dispose();
      await lifetime.close();
    },
  };
}
export function clientFixtures(environmentId = 'environment') {
  const owned: ReturnType<typeof createClientFixture>[] = [];
  afterEach(async () => {
    for (const subject of owned.splice(0)) await subject.cleanup();
  });
  return (
    transport: Transport,
    cacheIdentity?: readonly string[],
    timeoutMs = 10_000,
    identity = environmentId,
  ) => {
    const subject = createClientFixture({
      environmentId: identity,
      transport,
      timeoutMs,
      ...(cacheIdentity ? { cacheIdentity } : {}),
    });
    owned.push(subject);
    return subject;
  };
}
export function scopedClientFixture(transport: Transport) {
  return Effect.acquireRelease(
    Effect.sync(() =>
      createClientFixture({
        environmentId: 'environment',
        transport,
        timeoutMs: 10_000,
      }),
    ),
    (subject) => Effect.promise(subject.cleanup),
  );
}

export function unreachableClientFixture() {
  const create = clientFixtures();
  return () => {
    const sent: string[] = [];
    const failure = new TypeError('Network request failed');
    const subject = create((path) => {
      sent.push(path);
      return Promise.reject(failure);
    });
    return { ...subject, sent, failure };
  };
}

export function sharedMemoConnections() {
  const memoMap = Layer.makeMemoMapUnsafe();
  const input = {
    environmentId: 'same-environment',
    transport: () => Promise.resolve(Response.json({})),
    timeoutMs: 1000,
  };
  return {
    first: createWorktreeConnection(input, memoMap, Layer.empty),
    second: createWorktreeConnection(input, memoMap, Layer.empty),
  };
}
