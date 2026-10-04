import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/query-core';

import { textQueryOptions } from './text.ts';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const response = {
  worktreeId: '00000000000000000000000000000000',
  path: 'README.md',
  encoding: 'utf-8',
  byteLength: 5,
  text: 'Hello',
};

function connection(
  transport: (path: string, init?: RequestInit) => Promise<Response>,
  controller = new AbortController(),
) {
  return {
    environmentId: 'environment',
    transport,
    request: (signal?: AbortSignal) => ({
      signal: signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal,
    }),
  };
}

describe('worktree reads stay with the selected connection', () => {
  it('isolates environments, worktrees, paths and pairing identities in the cache', () => {
    const connected = connection(() =>
      Promise.resolve(Response.json(response)),
    );
    expect(textQueryOptions(scope, connected, 'README.md').queryKey).toEqual([
      'review',
      'environment',
      'project',
      '00000000000000000000000000000000',
      'text',
      'README.md',
    ]);
    expect(
      textQueryOptions(
        scope,
        { ...connected, environmentId: 'other' },
        'README.md',
      ).queryKey,
    ).toEqual([
      'review',
      'other',
      'project',
      '00000000000000000000000000000000',
      'text',
      'README.md',
    ]);
    expect(
      textQueryOptions(
        scope,
        { ...connected, cacheIdentity: ['new-pairing'] },
        'README.md',
      ).queryKey,
    ).toEqual([
      'review',
      'environment',
      'project',
      '00000000000000000000000000000000',
      'text',
      'README.md',
      'new-pairing',
    ]);
    expect(
      textQueryOptions(
        { ...scope, worktreeId: '11111111111111111111111111111111' },
        connected,
        'README.md',
      ).queryKey,
    ).toEqual([
      'review',
      'environment',
      'project',
      '11111111111111111111111111111111',
      'text',
      'README.md',
    ]);
    expect(textQueryOptions(scope, connected, 'other.md').queryKey).toEqual([
      'review',
      'environment',
      'project',
      '00000000000000000000000000000000',
      'text',
      'other.md',
    ]);
  });

  it('rejects another worktree returned by the transport', async () => {
    const connected = connection(() =>
      Promise.resolve(
        Response.json({
          ...response,
          worktreeId: '11111111111111111111111111111111',
        }),
      ),
    );
    await expect(
      textQueryOptions(scope, connected, 'README.md').queryFn({
        signal: new AbortController().signal,
        client: new QueryClient(),
      }),
    ).rejects.toThrow('The connected context changed.');
  });

  it('rejects an answer that completed after disconnect even if the transport ignored cancellation', async () => {
    const controller = new AbortController();
    const connected = connection(() => {
      controller.abort();
      return Promise.resolve(Response.json(response));
    }, controller);
    await expect(
      textQueryOptions(scope, connected, 'README.md').queryFn({
        signal: new AbortController().signal,
        client: new QueryClient(),
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('forwards cancellation from the query to the transport', async () => {
    const controller = new AbortController();
    const connected = connection((_path, init) => {
      expect(init?.signal?.aborted).toBe(true);
      return Promise.resolve(Response.json(response));
    });
    controller.abort();
    await expect(
      textQueryOptions(scope, connected, 'README.md').queryFn({
        signal: controller.signal,
        client: new QueryClient(),
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
