import { describe, expect, it } from 'vitest';
import { createWorktreeConnection } from './worktree-connection.ts';

const transport = () => Promise.resolve(Response.json({}));
const input = {
  environmentId: 'environment',
  transport,
  cacheIdentity: ['https://machine', 'device'],
  timeoutMs: 15_000,
};

describe('a worktree connection owns its request lifetime', () => {
  it('keeps the supplied transport and cache identity and cancels every request when closed', () => {
    const lifetime = createWorktreeConnection(input);
    const first = lifetime.connection.request().signal;
    const second = lifetime.connection.request().signal;
    expect(lifetime.connection.transport).toBe(transport);
    expect(lifetime.connection.cacheIdentity).toEqual([
      'https://machine',
      'device',
    ]);
    expect([first.aborted, second.aborted]).toEqual([false, false]);
    lifetime.close();
    expect([
      first.aborted,
      second.aborted,
      lifetime.connection.request().signal.aborted,
    ]).toEqual([true, true, true]);
  });

  it('cancels a caller request without closing the whole connection', () => {
    const lifetime = createWorktreeConnection(input);
    const caller = new AbortController();
    const request = lifetime.connection.request(caller.signal).signal;
    caller.abort(new Error('Selection changed'));
    expect(request.reason).toMatchObject({ message: 'Selection changed' });
    expect(lifetime.connection.request().signal.aborted).toBe(false);
    lifetime.close();
  });

  it('exposes the same controller to clients that already own their abort call', () => {
    const lifetime = createWorktreeConnection(input);
    const request = lifetime.connection.request().signal;
    lifetime.controller.abort();
    expect(request.aborted).toBe(true);
    expect(lifetime.connection.request().signal.aborted).toBe(true);
  });

  it('gives each request a fresh timeout using the configured budget', async () => {
    const lifetime = createWorktreeConnection({ ...input, timeoutMs: 5 });
    const firstRequest = lifetime.connection.request().signal;
    await expect.poll(() => firstRequest.aborted).toBe(true);
    expect(firstRequest.reason).toMatchObject({ name: 'TimeoutError' });
    expect(lifetime.connection.request().signal.aborted).toBe(false);
    lifetime.close();
  });

  it('opens a fresh lifetime after cleanup without reviving old requests', () => {
    const old = createWorktreeConnection(input);
    const request = old.connection.request().signal;
    old.close();
    const current = createWorktreeConnection(input);
    expect(request.aborted).toBe(true);
    expect(current.connection.request().signal.aborted).toBe(false);
    expect(current.connection).not.toBe(old.connection);
    current.close();
  });
});
