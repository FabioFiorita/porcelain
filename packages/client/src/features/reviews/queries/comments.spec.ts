import { afterEach, describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { createWorktreeConnection } from '@porcelain/client/transport';
import { readCommentThreads } from './comments.ts';

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
const owned: {
  close: () => Promise<void>;
  registry: AtomRegistry.AtomRegistry;
}[] = [];
function read(answer: object[]) {
  const lifetime = createWorktreeConnection({
    environmentId: 'environment',
    timeoutMs: 10_000,
    transport: () => Promise.resolve(Response.json(answer)),
  });
  const registry = AtomRegistry.make();
  owned.push({ close: lifetime.close, registry });
  return Effect.runPromise(
    AtomRegistry.getResult(
      registry,
      readCommentThreads({ scope, connection: lifetime.connection }),
    ),
  );
}
afterEach(async () => {
  for (const subject of owned) {
    subject.registry.dispose();
    await subject.close();
  }
  owned.length = 0;
});

describe('a discussion stays with its selected worktree', () => {
  it('accepts an empty discussion and the selected worktree discussion', async () => {
    expect(await read([])).toEqual([]);
    expect(await read([thread])).toEqual([thread]);
  });
  it('rejects a mixed discussion containing another worktree', async () => {
    await expect(
      read([
        thread,
        { ...thread, worktreeId: '11111111111111111111111111111111' },
      ]),
    ).rejects.toMatchObject({
      _tag: 'ConnectionError',
      message:
        'The connected context changed. Reopen Porcelain to continue safely.',
    });
  });
});
