import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import { expect, it } from 'vitest';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const fixture = clientFixtures('environment');

import { readDirectory, readDirectories } from './directory.ts';
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

it('reuses a confirmed folder when batching it with other folder paths', async () => {
  const subject = fixture(() => Promise.resolve(Response.json(response)));
  const selection = { connection: subject.connection, scope, path: 'src' };
  const atom = readDirectory(selection);
  const unmount = subject.registry.mount(atom);
  try {
    await Effect.runPromise(AtomRegistry.getResult(subject.registry, atom));
    const results = subject.registry.get(
      readDirectories({ ...selection, paths: ['src', 'nested'] }),
    );
    expect(results[0]).toMatchObject({
      _tag: 'Success',
      value: response,
      waiting: false,
    });
  } finally {
    unmount();
  }
});
