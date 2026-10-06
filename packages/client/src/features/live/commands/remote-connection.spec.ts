import { expect, it } from 'vitest';
import { Crypto, Effect, Layer, ManagedRuntime } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { FileDrafts, retainFileDraft } from '@porcelain/client/files';
import {
  OperationStorage,
  OperationStore,
} from '@porcelain/client/git-actions';
import type { AccessPlatformValue } from '@porcelain/client/access';
import { RemoteConnection } from './remote-connection.ts';

it('adopts a replacement remote connection without releasing application drafts or reusing its operation journal', async () => {
  const application = ManagedRuntime.make(FileDrafts.layer);
  const drafts = application.runSync(FileDrafts);
  const registry = AtomRegistry.make();
  const open = (address: string, send: AccessPlatformValue['send']) =>
    ManagedRuntime.make(
      RemoteConnection.layer({
        environmentId: 'environment',
        address,
        send,
        credential: 'test-credential',
        deviceId: 'device',
        timeoutMs: 1000,
        memoMap: application.memoMap,
        socket: () => Effect.die('This file save must not open a live socket'),
        cryptoLayer: Layer.succeed(
          Crypto.Crypto,
          Crypto.make({
            randomBytes: (length) => new Uint8Array(length),
            digest: (_, bytes) => Effect.succeed(bytes),
          }),
        ),
      }).pipe(
        Layer.provide(
          Layer.merge(
            FileDrafts.layer,
            Layer.fresh(OperationStore.layer).pipe(
              Layer.provide(
                Layer.succeed(OperationStorage, {
                  read: () => Effect.succeed(null),
                  write: () => Effect.void,
                  clear: () => Effect.void,
                }),
              ),
            ),
          ),
        ),
      ),
      { memoMap: application.memoMap },
    );
  let staleRequests = 0;
  const original = open('https://first.example', () => {
    staleRequests++;
    return Promise.resolve(Response.json({}));
  });
  const originalConnection = original.runSync(RemoteConnection);
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
    await original.dispose();
    expect(originalConnection.request().signal.aborted).toBe(true);
    expect(drafts.entries(originalConnection).size).toBe(1);
    expect(draft.claim('editor')).toBe(true);
    draft.release('editor');
    const current = replacement.runSync(RemoteConnection);
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
    await original.dispose();
    await replacement.dispose();
    await application.dispose();
  }
});
