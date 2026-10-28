import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import { Effect, Exit, Schema } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vitest';

import { revokeAccess, setDeviceTrust, setRemoteAccess } from './share.ts';
import { readRemoteAccess } from '@porcelain/client/access';
import {
  readRemoteAccessResponseSchema,
  type ReadRemoteAccessResponse,
  type SetRemoteAccessRequest,
} from '@porcelain/contracts/access';

const fixture = clientFixtures('environment');
const fingerprint = (digit: string) =>
  Schema.decodeUnknownSync(readRemoteAccessResponseSchema.fields.editing)({
    fingerprint: digit.repeat(64),
  }).fingerprint;

async function save(
  { connection, registry }: ReturnType<typeof fixture>,
  edit: SetRemoteAccessRequest,
) {
  const state = readRemoteAccess(connection);
  registry.mount(state);
  await Effect.runPromise(AtomRegistry.getResult(registry, state));
  const command = setRemoteAccess(connection);
  registry.mount(command);
  registry.set(command, edit);
  return {
    state,
    finished: Effect.runPromiseExit(
      AtomRegistry.getResult(registry, command, { suspendOnWaiting: true }),
    ),
  };
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
  const current: ReadRemoteAccessResponse = {
    routes: { lan: off, tailnet: off, cloudflare: off },
    serviceUrl: 'http://127.0.0.1:4173',
    editing: { fingerprint: fingerprint('a') },
  };
  let release: ((response: Response) => void) | undefined;
  let entered: (() => void) | undefined;
  let signal: AbortSignal | null | undefined;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const environment = fixture((_path, init) => {
    if (init?.method !== 'PATCH')
      return Promise.resolve(Response.json(current));
    signal = init.signal;
    return new Promise((resolve) => {
      release = resolve;
      entered?.();
    });
  });
  const { connection, registry } = environment;
  const { state, finished } = await save(environment, {
    expected: current.editing.fingerprint,
    change: { cloudflareHostname: 'porcelain.example.com' },
  });
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

it('a save refused because the ways in changed reads them again and shows the newer ways in, without sending the save twice', async () => {
  const off = { enabled: false, status: { kind: 'off' as const } };
  const first: ReadRemoteAccessResponse = {
    routes: { lan: off, tailnet: off, cloudflare: off },
    serviceUrl: 'http://127.0.0.1:4173',
    editing: { fingerprint: fingerprint('a'), protectedRoute: 'tailnet' },
  };
  const newer: ReadRemoteAccessResponse = {
    ...first,
    routes: { ...first.routes, lan: { enabled: true, status: off.status } },
    editing: { ...first.editing, fingerprint: fingerprint('b') },
  };
  const requests: string[] = [];
  const environment = fixture((path, init) => {
    requests.push(`${init?.method ?? 'GET'} ${path}`);
    if (init?.method === 'PATCH')
      return Promise.resolve(
        Response.json(
          {
            statusCode: 409,
            error: 'Conflict',
            message:
              'The ways in changed since you last looked. Check them again, then save your change.',
          },
          { status: 409 },
        ),
      );
    return Promise.resolve(
      Response.json(requests.length === 1 ? first : newer),
    );
  });
  const { registry } = environment;
  const { state, finished } = await save(environment, {
    expected: first.editing.fingerprint,
    change: { cloudflare: false },
  });

  const saved = await finished;

  expect(Exit.isFailure(saved)).toBe(true);
  await expect(Effect.runPromise(saved)).rejects.toMatchObject({
    _tag: 'WaysInChangedError',
    message:
      'The ways in changed since you last looked. Check them again, then save your change.',
  });
  await expect
    .poll(() => Effect.runPromise(AtomRegistry.getResult(registry, state)))
    .toEqual(newer);
  expect(requests).toEqual([
    'GET /api/remote-access',
    'PATCH /api/remote-access',
    'GET /api/remote-access',
  ]);
});
