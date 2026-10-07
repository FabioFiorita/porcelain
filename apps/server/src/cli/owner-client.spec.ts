import { Cause, Effect, Exit, Fiber } from 'effect';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { ownerClient, ownerRequest, probeOwner } from './owner-client.ts';

const owned: { directory: string; server: Server }[] = [];
afterEach(async () => {
  for (const { directory, server } of owned.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
async function fixture(
  answer: (
    path: string,
    body: unknown,
  ) => { status: number; body: unknown } | undefined,
) {
  const directory = await mkdtemp(join(tmpdir(), 'pc-owner-'));
  const calls: {
    method: string | undefined;
    path: string | undefined;
    body: unknown;
  }[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      const body: unknown = text ? JSON.parse(text) : undefined;
      calls.push({ method: request.method, path: request.url, body });
      const result = answer(request.url ?? '', body);
      if (result === undefined) return;
      response.writeHead(result.status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(result.body));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(ownerSocketPath(directory), resolve);
  });
  owned.push({ directory, server });
  return {
    api: await Effect.runPromise(ownerClient(directory, 1000)),
    calls,
    directory,
    server,
  };
}

it('uses the native owner paths and validates JSON in both directions over the actual socket', async () => {
  const test = await fixture((path) => ({
    status: 200,
    body:
      path === '/access'
        ? { grants: [], devices: [] }
        : { id: 'device-1', trusted: true },
  }));
  await expect(
    Effect.runPromise(ownerRequest(test.api.administration.listAccess())),
  ).resolves.toEqual({ grants: [], devices: [] });
  await expect(
    Effect.runPromise(
      ownerRequest(
        test.api.administration.setDeviceTrust({
          payload: { id: 'device-1', trusted: true },
        }),
      ),
    ),
  ).resolves.toEqual({ id: 'device-1', trusted: true });
  expect(test.calls).toEqual([
    { method: 'GET', path: '/access', body: undefined },
    {
      method: 'POST',
      path: '/access/trust',
      body: { id: 'device-1', trusted: true },
    },
  ]);
});

it('reports an absent owner socket and a malformed successful answer', async () => {
  const test = await fixture(() => ({ status: 200, body: { invalid: true } }));
  await expect(
    Effect.runPromise(ownerRequest(test.api.administration.listAccess())),
  ).rejects.toMatchObject({
    name: 'OwnerRequestError',
    message: 'The server answered unrecognizably.',
  });
  const absent = join(test.directory, 'missing');
  await expect(
    Effect.runPromise(
      ownerRequest(
        (
          await Effect.runPromise(ownerClient(absent, 1000))
        ).administration.listAccess(),
      ),
    ),
  ).rejects.toMatchObject({
    name: 'OwnerRequestError',
    message: `Porcelain is not running for ${absent}.`,
  });
});

it('keeps refused owner response messages in the typed error channel', async () => {
  const test = await fixture(() => ({
    status: 503,
    body: { message: 'Owner is shutting down.' },
  }));
  const exit = await Effect.runPromiseExit(
    ownerRequest(test.api.administration.listAccess()),
  );
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    expect(Cause.hasDies(exit.cause)).toBe(false);
    expect(Cause.squash(exit.cause)).toMatchObject({
      _tag: 'OwnerRequestError',
      message: 'Owner is shutting down.',
    });
  }
});

it('times out a silent owner and releases its connection', async () => {
  const test = await fixture(() => undefined);
  const closed = Promise.withResolvers<void>();
  test.server.once('connection', (socket) =>
    socket.once('close', () => closed.resolve()),
  );
  const api = await Effect.runPromise(ownerClient(test.directory, 50));
  const exit = await Effect.runPromiseExit(
    ownerRequest(api.administration.listAccess()),
  );
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    expect(Cause.hasDies(exit.cause)).toBe(false);
    expect(Cause.squash(exit.cause)).toMatchObject({
      _tag: 'OwnerRequestError',
      message: 'The server did not answer in time.',
    });
  }
  await closed.promise;
});

it('interrupts an in-flight owner request and closes the actual socket', async () => {
  const test = await fixture(() => undefined);
  const arrived = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>();
  test.server.once('request', (request) => {
    request.socket.once('close', () => closed.resolve());
    arrived.resolve();
  });
  const exit = await Effect.runPromise(
    Effect.gen(function* () {
      const request = yield* Effect.forkChild(
        ownerRequest(test.api.administration.listAccess()),
      );
      yield* Effect.promise(() => arrived.promise);
      yield* Fiber.interrupt(request);
      return yield* Fiber.await(request);
    }),
  );
  expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
    true,
  );
  await closed.promise;
});

it('rejects an invalid outgoing payload before opening the socket', async () => {
  const test = await fixture(() => ({
    status: 200,
    body: { id: 'device-1', trusted: true },
  }));
  const exit = await Effect.runPromiseExit(
    ownerRequest(
      test.api.administration.setDeviceTrust({
        payload: { id: '', trusted: true },
      }),
    ),
  );
  expect(Exit.isFailure(exit)).toBe(true);
  expect(test.calls).toEqual([]);
});

it('keeps absent, failed and malformed status probes distinct', async () => {
  const test = await fixture((path) => ({
    status: path === '/status' ? 503 : 200,
    body: {},
  }));
  await expect(
    Effect.runPromise(
      probeOwner({
        socketPath: ownerSocketPath(test.directory),
        timeoutMs: 1000,
      }),
    ),
  ).resolves.toEqual({
    kind: 'unreadable',
    reason: 'the owner socket answered 503',
  });
  await expect(
    Effect.runPromise(
      probeOwner({
        socketPath: ownerSocketPath(join(test.directory, 'missing')),
        timeoutMs: 1000,
      }),
    ),
  ).resolves.toEqual({ kind: 'absent' });
  const malformed = await fixture(() => ({ status: 200, body: {} }));
  await expect(
    Effect.runPromise(
      probeOwner({
        socketPath: ownerSocketPath(malformed.directory),
        timeoutMs: 1000,
      }),
    ),
  ).resolves.toEqual({
    kind: 'unreadable',
    reason: 'the owner socket answered something unrecognizable',
  });
});
