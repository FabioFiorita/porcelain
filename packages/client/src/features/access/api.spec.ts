import { describe, expect, it } from 'vitest';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { createRemoteApi } from './api.ts';
const environment = {
  environmentId: 'saved-environment',
  name: 'Computer',
  version: '1.0.0',
  protocol: ENVIRONMENT_PROTOCOL,
};
const api = createRemoteApi({ name: () => 'iOS' });
type Transport = Parameters<typeof api.describe>[0]['transport'];

async function status(
  transport: Transport,
  signal = new AbortController().signal,
) {
  return api.describe({
    transport: transport,
    signal: signal,
    environmentId: environment.environmentId,
  });
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
        expect(init?.signal).toBe(controller.signal);
        if (path === '/api/environment')
          return Promise.resolve(Response.json(environment));
        controller.abort();
        return Promise.reject(controller.signal.reason);
      }, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('answers unreachable when the authenticated read times out', async () => {
    const controller = new AbortController();
    expect(
      await status((path) => {
        if (path === '/api/environment')
          return Promise.resolve(Response.json(environment));
        controller.abort(new DOMException('Timed out', 'TimeoutError'));
        return Promise.reject(controller.signal.reason);
      }, controller.signal),
    ).toEqual({ kind: 'unreachable' });
  });
});
