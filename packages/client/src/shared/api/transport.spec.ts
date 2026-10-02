import { describe, expect, it } from 'vitest';
import { remoteTransport } from './transport.ts';

describe('remoteTransport', () => {
  it('sends a remote credential without sharing browser cookies or following redirects', async () => {
    const controller = new AbortController();
    const received: Request[] = [];
    const headers = new Headers({ 'content-type': 'application/json' });
    const transport = remoteTransport(
      'https://remote.test',
      'secret',
      (input, init) => {
        received.push(new Request(input, init));
        return Promise.resolve(Response.json({ connected: true }));
      },
    );
    await transport('/api/projects', {
      method: 'POST',
      headers,
      body: '{}',
      signal: controller.signal,
    });
    const request = received[0];
    expect(request?.url).toBe('https://remote.test/api/projects');
    expect(request?.headers.get('authorization')).toBe('Bearer secret');
    expect(request?.headers.get('content-type')).toBe('application/json');
    expect(request?.credentials).toBe('omit');
    expect(request?.redirect).toBe('error');
    expect(request?.cache).toBe('no-store');
    expect(request?.method).toBe('POST');
    expect(request?.signal.aborted).toBe(false);
    controller.abort();
    expect(request?.signal.aborted).toBe(true);
    expect(headers.has('authorization')).toBe(false);
  });

  it('pairs an untrusted remote without adding a credential', async () => {
    const received: Request[] = [];
    const transport = remoteTransport(
      'http://192.168.1.2:4141',
      undefined,
      (input, init) => {
        received.push(new Request(input, init));
        return Promise.resolve(Response.json({ paired: true }));
      },
    );
    await transport('/api/pair', { method: 'POST', body: '{}' });
    expect(received[0]?.url).toBe('http://192.168.1.2:4141/api/pair');
    expect(received[0]?.headers.has('authorization')).toBe(false);
  });
});
