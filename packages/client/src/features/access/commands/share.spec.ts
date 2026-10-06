import { Effect, Exit } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { afterEach, expect, it } from 'vitest';
import {
  createWorktreeConnection,
  type RuntimeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { revokeAccess, setDeviceTrust, setRemoteAccess } from './share.ts';
import { readRemoteAccess } from '@porcelain/client/access';

const scopes = new Set<{
  connection: RuntimeConnection;
  registry: AtomRegistry.AtomRegistry;
}>();
afterEach(async () => {
  for (const { connection, registry } of scopes) {
    registry.dispose();
    await connection.close();
  }
  scopes.clear();
});
function fixture(transport: Transport) {
  const { connection } = createWorktreeConnection({
    environmentId: 'environment',
    transport,
    timeoutMs: 10_000,
  });
  const registry = AtomRegistry.make();
  scopes.add({ connection, registry });
  return { connection, registry };
}

it('a failed device write rejects its queued follower without sending it, then allows an explicit new action', async () => {
  const requests: string[] = [];
  let release: ((response: Response) => void) | undefined;
  let entered: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const { connection, registry } = fixture((path) => {
    requests.push(path);
    if (requests.length === 1)
      return new Promise((resolve) => {
        release = resolve;
        entered?.();
      });
    return Promise.resolve(
      Response.json(
        path === '/api/access'
          ? { devices: [], grants: [] }
          : { id: '33333333-3333-4333-8333-333333333333', trusted: true },
      ),
    );
  });
  const revoke = revokeAccess({
    connection,
    id: '22222222-2222-4222-8222-222222222222',
  });
  const trust = setDeviceTrust({
    connection,
    id: '33333333-3333-4333-8333-333333333333',
  });
  registry.mount(revoke);
  registry.mount(trust);
  registry.set(revoke, undefined);
  const failed = Effect.runPromiseExit(
    AtomRegistry.getResult(registry, revoke, { suspendOnWaiting: true }),
  );
  await started;
  registry.set(trust, true);
  const rejected = Effect.runPromiseExit(
    AtomRegistry.getResult(registry, trust, { suspendOnWaiting: true }),
  );
  release?.(new Response(null, { status: 503 }));
  expect(Exit.isFailure(await failed)).toBe(true);
  const follower = await rejected;
  expect(Exit.isFailure(follower)).toBe(true);
  await expect(Effect.runPromise(follower)).rejects.toMatchObject({
    _tag: 'WriteNotSentError',
    cause: { status: 503 },
  });
  expect(requests.filter((path) => path !== '/api/access')).toEqual([
    '/api/access/revoke',
  ]);
  registry.set(trust, true);
  await Effect.runPromise(
    AtomRegistry.getResult(registry, trust, { suspendOnWaiting: true }),
  );
  expect(requests.filter((path) => path !== '/api/access')).toEqual([
    '/api/access/revoke',
    '/api/access/trust',
  ]);
});

it('closing the connection aborts a settings write and never publishes a late reply into its confirmed state', async () => {
  const off = { enabled: false, status: { kind: 'off' as const } };
  const current = {
    routes: { lan: off, tailnet: off, cloudflare: off },
    serviceUrl: 'http://127.0.0.1:4173',
  };
  let release: ((response: Response) => void) | undefined;
  let entered: (() => void) | undefined;
  let signal: AbortSignal | null | undefined;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const { connection, registry } = fixture((_path, init) => {
    if (init?.method !== 'PATCH')
      return Promise.resolve(Response.json(current));
    signal = init.signal;
    return new Promise((resolve) => {
      release = resolve;
      entered?.();
    });
  });
  const state = readRemoteAccess(connection);
  registry.mount(state);
  await Effect.runPromise(AtomRegistry.getResult(registry, state));
  const command = setRemoteAccess(connection);
  registry.mount(command);
  registry.set(command, { cloudflareHostname: 'porcelain.example.com' });
  const finished = Effect.runPromiseExit(
    AtomRegistry.getResult(registry, command, { suspendOnWaiting: true }),
  );
  await started;
  await connection.close();
  expect(signal?.aborted).toBe(true);
  release?.(
    Response.json({ ...current, cloudflareHostname: 'porcelain.example.com' }),
  );
  expect(Exit.isFailure(await finished)).toBe(true);
  const answer = await Effect.runPromise(
    AtomRegistry.getResult(registry, state),
  );
  expect(answer).toEqual(current);
});
