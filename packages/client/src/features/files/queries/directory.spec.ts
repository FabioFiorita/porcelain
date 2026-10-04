import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/query-core';

import { directoryQueryOptions } from './directory.ts';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const response = {
  worktreeId: '00000000000000000000000000000000',
  path: 'src',
  entries: [{ name: 'index.ts', kind: 'file' }],
};

function connection(answer: object) {
  return {
    environmentId: 'environment',
    transport: () => Promise.resolve(Response.json(answer)),
    request: (signal?: AbortSignal) => ({
      signal: signal ?? new AbortController().signal,
    }),
  };
}

describe('a directory read stays with the selected worktree', () => {
  it('returns the listing of the selected worktree', async () => {
    await expect(
      directoryQueryOptions(scope, connection(response), 'src').queryFn({
        signal: new AbortController().signal,
        client: new QueryClient(),
      }),
    ).resolves.toEqual(response);
  });

  it('rejects another worktree returned by the transport', async () => {
    await expect(
      directoryQueryOptions(
        scope,
        connection({
          ...response,
          worktreeId: '11111111111111111111111111111111',
        }),
        'src',
      ).queryFn({
        signal: new AbortController().signal,
        client: new QueryClient(),
      }),
    ).rejects.toThrow('The connected context changed.');
  });
});
