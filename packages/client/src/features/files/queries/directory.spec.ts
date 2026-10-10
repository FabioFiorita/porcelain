import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import { expect, it } from 'vitest';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const fixture = clientFixtures('environment');

import { readDirectory } from './directory.ts';
const response = {
  worktreeId: scope.worktreeId,
  path: 'src',
  entries: [{ name: 'index.ts', kind: 'file' }],
};
it('returns the listing of the selected worktree', async () => {
  const subject = fixture(() => Promise.resolve(Response.json(response)));
  expect(
    await Effect.runPromise(
      AtomRegistry.getResult(
        subject.registry,
        readDirectory({ connection: subject.connection, scope, path: 'src' }),
      ),
    ),
  ).toEqual(response);
});
it('rejects another worktree returned by the transport', async () => {
  const subject = fixture(() =>
    Promise.resolve(
      Response.json({
        ...response,
        worktreeId: '11111111111111111111111111111111',
      }),
    ),
  );
  await expect(
    Effect.runPromise(
      AtomRegistry.getResult(
        subject.registry,
        readDirectory({ connection: subject.connection, scope, path: 'src' }),
      ),
    ),
  ).rejects.toThrow('The connected context changed.');
});
