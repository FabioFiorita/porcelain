import { NodeCrypto } from '@effect/platform-node';
import { Equal, Effect, Layer } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { expect } from 'vitest';
import { test } from '@porcelain/server/kit/server-test';
import { read, worktreePath } from '@porcelain/server/kit/requests';
import { readChanges, readReviewedFiles } from '@porcelain/client/changes';
import { OperationStore } from '@porcelain/client/git-actions';
import { liveQueries, type LiveUpdatePort } from '@porcelain/client/live';
import { createWorktreeConnection } from '@porcelain/client/transport';
import { liveSessionState } from '../../src/features/live/store.ts';
import { connection } from '../kit/connection.ts';
import { readClientAtom } from '../kit/client-fixture.ts';
import { operationStoreFixture } from '../kit/operation-store.ts';

test('mounted worktree marks catch up after external writes and reconnect while Git changes remain readable', async ({
  server,
  session,
}) => {
  const { connected: base, scope } = await connection(server, session);
  const { store: operations } = operationStoreFixture();
  const lifetime = createWorktreeConnection(
    {
      environmentId: base.environmentId,
      timeoutMs: 15000,
      transport: base.transport,
    },
    undefined,
    Layer.merge(
      NodeCrypto.layerSecureRandom,
      Layer.succeed(OperationStore, operations),
    ),
  );
  const registry = AtomRegistry.make();
  let callbacks: Parameters<LiveUpdatePort['connect']>[0] | undefined;
  const liveUpdates: LiveUpdatePort = {
    state: liveSessionState(),
    connect: (options) =>
      Effect.sync(() => {
        callbacks = options;
        return { subscribe: () => {} };
      }),
  };
  const connected = Equal.byReference({
    ...lifetime.connection,
    operations,
    liveUpdates,
  });
  const marks = readReviewedFiles({ connection: connected, scope });
  const changes = readChanges({ connection: connected, scope });
  const stops = [
    registry.mount(marks),
    registry.mount(changes),
    registry.mount(liveQueries({ connection: connected })),
  ];
  try {
    await readClientAtom(registry, liveQueries({ connection: connected }));
    const initial = await readClientAtom(registry, changes);
    const file = initial.changes[0];
    if (!file?.fingerprint || !callbacks)
      throw new Error('Expected a subscribed changed file');
    expect((await readClientAtom(registry, marks)).marks).toEqual([]);
    await read(session, {
      method: 'PUT',
      path: worktreePath(session, '/reviewed'),
      body: { path: file.path, fingerprint: file.fingerprint, reviewed: true },
    });
    callbacks.onNotice({ type: 'worktree', ...scope, change: 'reviewed' });
    await expect
      .poll(async () =>
        (await readClientAtom(registry, marks)).marks.map((mark) => mark.path),
      )
      .toEqual([file.path]);
    await read(session, {
      method: 'DELETE',
      path: worktreePath(
        session,
        `/reviewed?path=${encodeURIComponent(file.path)}`,
      ),
    });
    callbacks.onReconnect();
    callbacks.onNotice({ type: 'ready' });
    await expect
      .poll(async () => (await readClientAtom(registry, marks)).marks)
      .toEqual([]);
    await session.writeFile(file.path, 'Updated while reading\n');
    callbacks.onNotice({ type: 'worktree', ...scope, change: 'files' });
    await expect
      .poll(
        async () =>
          (await readClientAtom(registry, changes)).changes[0]?.fingerprint,
      )
      .not.toBe(file.fingerprint);
  } finally {
    for (const stop of stops) stop();
    registry.dispose();
    await lifetime.close();
  }
});
