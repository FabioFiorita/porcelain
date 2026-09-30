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

  it('reports nothing for a refusal the client caused', () => {
    expect(
      requestFailure(new Error('no'), 401, request('/api/inventory?ticket=x')),
    ).toBeUndefined();
  });

  it('reports nothing when the client abandoned the request', () => {
    expect(
      requestFailure(
        new DOMException('The request was abandoned', 'AbortError'),
        500,
        request('/api/inventory', true),
      ),
    ).toBeUndefined();
  });
});
