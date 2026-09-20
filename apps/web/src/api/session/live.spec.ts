import { describe, expect, it } from 'vitest';
import { createMockStore } from '../inventory/mock';
import { onUnauthorized } from '../unauthorized';
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

describe('browser transport', () => {
  it('sends the device cookie and never a credential of its own', async () => {
    const { calls, transport } = recordingTransport(() => ok({}));
    await browserTransport(transport)('/api/inventory', {
      headers: { authorization: 'Bearer something-a-page-found' },
    });
    const headers = new Headers(calls[0]?.init?.headers);
    // A page that can attach a credential is a page that can leak one.
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-porcelain-browser')).toBe('1');
    expect(calls[0]?.init?.credentials).toBe('same-origin');
  });

  it('reports a refused request once, from the transport, for every caller', async () => {
    const seen: number[] = [];
    const stop = onUnauthorized(() => seen.push(1));
    try {
      const refused = browserTransport(
        recordingTransport(() => new Response('{}', { status: 401 })).transport,
      );
      // Whatever the view was asking for, losing access is the same event.
      await refused('/api/inventory');
      await refused('/api/worktrees/w/comments');
      expect(seen).toHaveLength(2);

      // Establishing a connection is not losing one: redeeming a link and
      // probing for a session both run before the browser knows whether it
      // has access at all.
      seen.length = 0;
      await refused('/api/pair', { method: 'POST' });
      await refused('/api/session');
      expect(seen).toHaveLength(0);

      // Nothing else is a loss of access.
      for (const status of [200, 403, 404, 500]) {
        await browserTransport(
          recordingTransport(() => new Response('{}', { status })).transport,
        )('/api/inventory');
      }
      expect(seen).toHaveLength(0);
    } finally {
      stop();
    }
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
