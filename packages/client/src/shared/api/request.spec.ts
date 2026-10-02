import { describe, expect, it } from 'vitest';
import { requestJson } from './request.ts';

describe('requestJson', () => {
  it('parses a successful response and forwards the cancellation signal', async () => {
    const controller = new AbortController();
    const received: { path: string; init: RequestInit | undefined }[] = [];
    const value = await requestJson(
      (path, init) => {
        received.push({ path, init });
        return Promise.resolve(Response.json({ environmentId: 'remote' }));
      },
      '/api/environment',
      { parse: (body: unknown) => body },
      { method: 'GET', signal: controller.signal },
    );
    expect(value).toEqual({ environmentId: 'remote' });
    expect(received).toEqual([
      {
        path: '/api/environment',
        init: {
          method: 'GET',
          signal: controller.signal,
          redirect: 'error',
          cache: 'no-store',
        },
      },
    ]);
  });

  it('preserves the server status, error message and conflict code', async () => {
    const response = Response.json(
      {
        statusCode: 409,
        error: 'Conflict',
        message: 'The file changed on disk.',
        code: 'content_changed',
      },
      { status: 409 },
    );
    await expect(
      requestJson(
        () => Promise.resolve(response),
        '/api/files',
        { parse: (body: unknown) => body },
        { method: 'POST' },
      ),
    ).rejects.toMatchObject({
      name: 'RequestError',
      status: 409,
      message: 'The file changed on disk.',
      code: 'content_changed',
    });
  });

  it('reports an unreadable rejection as a request failure', async () => {
    await expect(
      requestJson(
        () => Promise.resolve(new Response('unavailable', { status: 503 })),
        '/api/environment',
        { parse: (body: unknown) => body },
        { method: 'GET' },
      ),
    ).rejects.toMatchObject({
      name: 'RequestError',
      status: 503,
      message: 'Request failed (503)',
      code: undefined,
    });
  });

  it('parses explicitly accepted responses even when their status is an error', async () => {
    const receipt = { status: 'rejected' };
    await expect(
      requestJson(
        () => Promise.resolve(Response.json(receipt, { status: 409 })),
        '/api/git/requests',
        { parse: (body: unknown) => body },
        { method: 'POST' },
        [409],
      ),
    ).resolves.toEqual(receipt);
  });

  it('reports an unreachable server while retaining the transport failure', async () => {
    const failure = new TypeError('Network request failed');
    await expect(
      requestJson(
        () => Promise.reject(failure),
        '/api/environment',
        { parse: (body: unknown) => body },
        { method: 'GET' },
      ),
    ).rejects.toMatchObject({
      name: 'ConnectionError',
      cause: failure,
      message: 'Could not reach Porcelain. Try again.',
    });
  });

  it('keeps a cancelled request distinct from an unreachable server', async () => {
    const controller = new AbortController();
    const cancelled = new Error('Workspace disconnected');
    controller.abort(cancelled);
    await expect(
      requestJson(
        () => Promise.reject(cancelled),
        '/api/environment',
        { parse: (body: unknown) => body },
        { method: 'GET', signal: controller.signal },
      ),
    ).rejects.toBe(cancelled);
  });

  it('rejects a response that the contract parser refuses', async () => {
    const invalid = new Error('Invalid environment response');
    await expect(
      requestJson(
        () => Promise.resolve(Response.json({ malformed: true })),
        '/api/environment',
        {
          parse() {
            throw invalid;
          },
        },
        { method: 'GET' },
      ),
    ).rejects.toBe(invalid);
  });
});
