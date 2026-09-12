import { describe, expect, it } from 'vitest';
import { createMockStore } from '../inventory/mock';
import { browserTransport, createSessionLive } from './live';

type Call = { input: RequestInfo | URL; init: RequestInit | undefined };

function recordingTransport(respond: () => Response) {
  const calls: Call[] = [];
  const transport = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return Promise.resolve(respond());
  }) as typeof fetch;
  return { calls, transport };
}

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('browser session transport', () => {
  it('replaces the placeholder bearer token with the browser session marker', async () => {
    const { calls, transport } = recordingTransport(() => ok({}));
    await browserTransport(transport)('/api/session', {
      headers: { authorization: 'Bearer browser-session' },
    });
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-porcelain-browser')).toBe('1');
    expect(calls[0]?.init?.credentials).toBe('same-origin');
  });

  it('keeps a real access token so playground requests still authenticate', async () => {
    const { calls, transport } = recordingTransport(() => ok({}));
    await browserTransport(transport)('/api/inventory', {
      headers: { authorization: 'Bearer fixture-token' },
    });
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('authorization')).toBe('Bearer fixture-token');
    expect(headers.get('x-porcelain-browser')).toBe('1');
  });
});

describe('live session port', () => {
  it('restores the inventory an authenticated session returns', async () => {
    const { inventory } = createMockStore();
    const { calls, transport } = recordingTransport(() => ok(inventory));
    const session = createSessionLive(transport);
    const restored = await session.restore(AbortSignal.timeout(1000));
    expect(restored.environmentId).toBe(inventory.environmentId);
    expect(calls[0]?.init?.cache).toBe('no-store');
    expect(calls[0]?.init?.redirect).toBe('error');
  });

  it('reports no active session when the request is refused', async () => {
    const { transport } = recordingTransport(
      () => new Response('', { status: 401 }),
    );
    await expect(
      createSessionLive(transport).restore(AbortSignal.timeout(1000)),
    ).rejects.toThrow('No active browser session');
  });

  it('ends the session with an explicit delete', async () => {
    const { calls, transport } = recordingTransport(
      () => new Response(null, { status: 204 }),
    );
    await createSessionLive(transport).disconnect();
    expect(calls[0]?.init?.method).toBe('DELETE');
  });

  it('reports a refused logout so the session is not dropped locally', async () => {
    const { transport } = recordingTransport(
      () => new Response('', { status: 500 }),
    );
    await expect(createSessionLive(transport).disconnect()).rejects.toThrow(
      'Could not end the browser session',
    );
  });
});
