import { describe, expect } from 'vitest';
import { it } from '@effect/vitest';
import { Deferred, Effect, Fiber } from 'effect';
import { TestClock } from 'effect/testing';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { readRemoteEnvironment } from './environments.ts';
import { runRequest } from '@porcelain/client/transport';
import type { Transport } from '@porcelain/client/transport';
const environment = {
  environmentId: 'saved-environment',
  name: 'Computer',
  version: '1.0.0',
  protocol: ENVIRONMENT_PROTOCOL,
};
async function status(
  transport: Transport,
  signal = new AbortController().signal,
) {
  return runRequest(
    readRemoteEnvironment(transport, environment.environmentId),
    signal,
  );
}

describe('environment status', () => {
  it.each([
    [200, 'described'],
    [401, 'unauthorized'],
    [503, 'unreachable'],
  ])('maps the authenticated read answering %s to %s', async (code, kind) => {
    const paths: string[] = [];
    const result = await status((path) => {
      paths.push(path);
      return Promise.resolve(
        path === '/api/environment'
          ? Response.json(environment)
          : code === 200
            ? Response.json({ kind: 'owner' })
            : new Response(null, { status: code }),
      );
    });
    expect(paths).toEqual(['/api/environment', '/api/session']);
    expect(result.kind).toBe(kind);
  });

  it.each([
    [
      'another environment',
      { ...environment, environmentId: 'another-environment' },
    ],
    [
      'a newer protocol',
      { ...environment, protocol: ENVIRONMENT_PROTOCOL + 1 },
    ],
    [
      'an older protocol',
      { ...environment, protocol: ENVIRONMENT_PROTOCOL - 1 },
    ],
  ])(
    'returns the descriptor of %s without an authenticated read',
    async (_, descriptor) => {
      const paths: string[] = [];
      expect(
        await status((path) => {
          paths.push(path);
          return Promise.resolve(Response.json(descriptor));
        }),
      ).toEqual({ kind: 'described', environment: descriptor });
      expect(paths).toEqual(['/api/environment']);
    },
  );

  it('answers unreachable when the authenticated read cannot be reached', async () => {
    expect(
      await status((path) =>
        path === '/api/environment'
          ? Promise.resolve(Response.json(environment))
          : Promise.reject(new TypeError('Network failed')),
      ),
    ).toEqual({ kind: 'unreachable' });
  });

  it('propagates cancellation during the authenticated read', async () => {
    const controller = new AbortController();
    await expect(
      status((path, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        if (path === '/api/environment')
          return Promise.resolve(Response.json(environment));
        controller.abort();
        return Promise.reject(controller.signal.reason);
      }, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

it.effect(
  'bounds a remote status read at five seconds and cancels its transport',
  () =>
    Effect.gen(function* () {
      let requestSignal: AbortSignal | undefined;
      const started = Deferred.makeUnsafe<void>();
      const result = yield* Effect.forkChild(
        readRemoteEnvironment((_path, init) => {
          requestSignal = init?.signal ?? undefined;
          Effect.runSync(Deferred.succeed(started, undefined));
          return new Promise<Response>((_resolve, reject) => {
            requestSignal?.addEventListener(
              'abort',
              () => reject(requestSignal?.reason),
              { once: true },
            );
          });
        }, environment.environmentId),
        { startImmediately: true },
      );
      yield* Deferred.await(started);
      yield* TestClock.adjust(4999);
      expect(requestSignal?.aborted).toBe(false);
      yield* TestClock.adjust(1);
      expect(yield* Fiber.join(result)).toEqual({ kind: 'unreachable' });
      expect(requestSignal?.aborted).toBe(true);
    }),
);
