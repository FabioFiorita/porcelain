import { describe, expect, it } from 'vitest';
import { requestFailure } from './error-handler.ts';

function request(url: string, abandoned = false) {
  const controller = new AbortController();
  if (abandoned) controller.abort();
  return { id: 'req-1', method: 'GET', url, disconnected: controller.signal };
}

describe('requestFailure', () => {
  it('reports a server failure by its path, never its query string, so a live ticket or signature in the URL stays out of the log', () => {
    const error = new Error('boom');
    const report = requestFailure(
      error,
      500,
      request('/api/live?ticket=pct_secret&signature=abc'),
    );
    expect(report).toEqual({
      kind: 'request',
      requestId: 'req-1',
      method: 'GET',
      url: '/api/live',
      error,
    });
    expect(JSON.stringify(report)).not.toContain('pct_secret');
  });

  it('reports nothing for a refusal the client caused, while the same failure as a server error is reported', () => {
    const error = new Error('no');
    expect(
      requestFailure(error, 401, request('/api/inventory?ticket=x')),
    ).toBeUndefined();
    expect(
      requestFailure(error, 500, request('/api/inventory?ticket=x')),
    ).toEqual({
      kind: 'request',
      requestId: 'req-1',
      method: 'GET',
      url: '/api/inventory',
      error,
    });
  });

  it('reports nothing when the client abandoned the request, while the same abort on a connected request is reported', () => {
    const error = new DOMException('The request was abandoned', 'AbortError');
    expect(
      requestFailure(error, 500, request('/api/inventory', true)),
    ).toBeUndefined();
    expect(requestFailure(error, 500, request('/api/inventory'))).toEqual({
      kind: 'request',
      requestId: 'req-1',
      method: 'GET',
      url: '/api/inventory',
      error,
    });
  });
});
