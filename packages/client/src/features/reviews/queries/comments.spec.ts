import { describe, expect, it } from 'vitest';
import { commentsQueryOptions } from './comments.ts';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const thread = {
  id: 'bb6a4c6a-4898-426c-ac20-bf4f53fc47d7',
  worktreeId: scope.worktreeId,
  anchor: { kind: 'change' },
  resolved: false,
  messages: [
    {
      id: 'eb90812a-6a3e-464e-92ca-5c962094b867',
      body: 'Explain the change.',
      author: 'reviewer',
    },
  ],
  revision: 1,
};
function connection(answer: object[]) {
  return {
    environmentId: 'environment',
    request: (signal?: AbortSignal) => ({
      signal: signal ?? new AbortController().signal,
    }),
    transport: () => Promise.resolve(Response.json(answer)),
  };
}

describe('a discussion stays with its selected worktree', () => {
  it('accepts an empty discussion and the selected worktree discussion', async () => {
    const signal = new AbortController().signal;
    expect(
      await commentsQueryOptions(scope, connection([])).queryFn({ signal }),
    ).toEqual([]);
    expect(
      await commentsQueryOptions(scope, connection([thread])).queryFn({
        signal,
      }),
    ).toEqual([thread]);
  });
  it('rejects a mixed discussion containing another worktree', async () => {
    await expect(
      commentsQueryOptions(
        scope,
        connection([
          thread,
          { ...thread, worktreeId: '11111111111111111111111111111111' },
        ]),
      ).queryFn({ signal: new AbortController().signal }),
    ).rejects.toThrow(
      'The connected context changed. Reopen Porcelain to continue safely.',
    );
  });
});
