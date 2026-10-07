import { expect, it } from 'vitest';
import {
  Redacted,
  Crypto,
  Effect,
  Exit,
  Fiber,
  Layer,
  ManagedRuntime,
} from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { FileDrafts, retainFileDraft } from '@porcelain/client/files';
import { OperationStorage, operationKey } from '@porcelain/client/git-actions';
import type { AccessPlatformValue } from '@porcelain/client/access';
import { openLiveConnection, openRemoteConnection } from './live-connection.ts';

it('adopts a replacement remote connection without releasing application drafts or reusing its operation journal', async () => {
  const application = ManagedRuntime.make(FileDrafts.layer);
  const drafts = application.runSync(FileDrafts);
  const registry = AtomRegistry.make();
  const open = (address: string, send: AccessPlatformValue['send']) => {
    return openRemoteConnection(
      {
        environmentId: 'environment',
        address,
        send,
        credential: Redacted.make('test-credential'),
        deviceId: 'device',
        timeoutMs: 1000,
        socket: () => Effect.die('This file save must not open a live socket'),
      },
      Layer.merge(
        Layer.succeed(
          Crypto.Crypto,
          Crypto.make({
            randomBytes: (length) => new Uint8Array(length),
            digest: (_, bytes) => Effect.succeed(bytes),
          }),
        ),
        Layer.succeed(OperationStorage, {
          read: () => Effect.succeed(null),
          write: () => Effect.void,
          clear: () => Effect.void,
        }),
      ),
      application.memoMap,
    );
  };
  let staleRequests = 0;
  const original = open('https://first.example', () => {
    staleRequests++;
    return Promise.resolve(Response.json({}));
  });
  const originalConnection = original;
  const written: { url: string; body: string }[] = [];
  const replacement = open('https://second.example', (url, init) => {
    const body = init?.body;
    if (!(body instanceof Uint8Array))
      throw new Error('Expected encoded request bytes');
    written.push({ url: url.href, body: new TextDecoder().decode(body) });
    return Promise.resolve(
      Response.json({ path: 'README.md', contentFingerprint: 'b'.repeat(64) }),
    );
  });
  const scope = { projectId: 'project', worktreeId: 'a'.repeat(32) };
  try {
    const draft = await Effect.runPromise(
      AtomRegistry.getResult(
        registry,
        retainFileDraft({
          connection: originalConnection,
          scope,
          path: 'README.md',
          text: 'Saved',
          fingerprint: 'a'.repeat(64),
        }),
      ),
    );
    await original.close();
    expect(originalConnection.isClosed()).toBe(true);
    expect(originalConnection.operations.state.value.closed).toBe(true);
    expect(drafts.entries(originalConnection).size).toBe(1);
    expect(draft.claim('editor')).toBe(true);
    draft.release('editor');
    const current = replacement;
    expect(current.operations).not.toBe(originalConnection.operations);
    expect(current.operations.state.value.closed).toBe(false);
    await Effect.runPromise(draft.change('Saved after reconnect'));
    expect(await Effect.runPromise(draft.save())).toBe(true);
    expect(draft.state.value.savedText).toBe('Saved after reconnect');
    expect(staleRequests).toBe(0);
    expect(written).toEqual([
      {
        url: `https://second.example/api/worktrees/${scope.worktreeId}/files`,
        body: JSON.stringify({
          kind: 'write',
          path: 'README.md',
          text: 'Saved after reconnect',
          expectedFingerprint: 'a'.repeat(64),
        }),
      },
    ]);
  } finally {
    registry.dispose();
    await original.close();
    await replacement.close();
    await application.dispose();
  }
});

it('closes the journal and interrupts receipt waits in the same lifetime as requests and platform resources', async () => {
  const application = ManagedRuntime.make(FileDrafts.layer);
  application.runSync(FileDrafts);
  const events: string[] = [];
  let retained: string | null = null;
  const connection = openLiveConnection(
    {
      environmentId: 'environment',
      address: 'https://machine.example',
      transport: () => Promise.resolve(Response.json({})),
      timeoutMs: 1000,
      liveUpdates: {
        connect: () => Effect.succeed({ subscribe: () => {} }),
      },
    },
    Layer.merge(
      Layer.effect(
        Crypto.Crypto,
        Effect.acquireRelease(
          Effect.sync(() => {
            events.push('open');
            return Crypto.make({
              randomBytes: (length) => new Uint8Array(length),
              digest: (_, bytes) => Effect.succeed(bytes),
            });
          }),
          () =>
            Effect.sync(() => {
              events.push('close');
            }),
        ),
      ),
      Layer.succeed(OperationStorage, {
        read: () => Effect.succeed(retained),
        write: (text) =>
          Effect.sync(() => {
            retained = text;
          }),
        clear: () =>
          Effect.sync(() => {
            retained = null;
          }),
      }),
    ),
    application.memoMap,
  );
  const scope = { projectId: 'project', worktreeId: 'a'.repeat(32) };
  const requestId = '11111111-1111-4111-8111-111111111111';
  const key = operationKey(scope, 'fetch');
  const request = {
    requestId,
    input: {
      action: 'fetch' as const,
      remoteName: 'origin',
      sourceRef: 'refs/heads/main',
    },
    expected: {
      headOid: undefined,
      branch: undefined,
      inProgress: undefined,
      mergeHeadOid: undefined,
    },
  };
  try {
    const crypto = connection.runtime.runSync(Crypto.Crypto);
    expect(connection.runtime.runSync(Crypto.Crypto)).toBe(crypto);
    await connection.runtime.runPromise(
      connection.operations.set(key, { ...scope, requestId, request }),
    );
    const waiting = connection.runtime.runFork(
      connection.operations.wait(key, requestId),
    );
    const closed = connection.isClosed;
    await connection.close();
    expect(closed()).toBe(true);
    expect(connection.operations.state.value).toMatchObject({
      closed: true,
      operations: new Map(),
    });
    expect(Exit.isFailure(await Effect.runPromise(Fiber.await(waiting)))).toBe(
      true,
    );
    expect(JSON.parse(retained ?? 'null')).toEqual([
      {
        ...scope,
        requestId,
        request: {
          ...request,
          expected: {
            headOid: null,
            branch: null,
            inProgress: null,
            mergeHeadOid: null,
          },
        },
      },
    ]);
    expect(events).toEqual(['open', 'close']);
  } finally {
    await connection.close();
    await application.dispose();
  }
});
