import { Effect, HashMap } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vitest';
import {
  clientFixtures,
  readClientAtom,
  visitClientRead,
} from '../../../../spec/kit/client-fixture.ts';
import { ReadSubscriptions } from '../../../shared/api/read-subscriptions.ts';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const fixture = clientFixtures('environment');

import { readDirectories, readDirectory } from './directory.ts';
const response = {
  worktreeId: scope.worktreeId,
  path: 'src',
  entries: [{ name: 'index.ts', kind: 'file' }],
};
it('retains the confirmed folder through closing and reopening without retaining its live read', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  let reads = 0;
  const subject = fixture(() => {
    if (++reads === 1) return Promise.resolve(Response.json(response));
    started.resolve();
    return held.promise;
  });
  const atom = readDirectory({
    connection: subject.connection,
    scope,
    path: 'src',
  });
  expect(await visitClientRead(subject.registry, atom)).toEqual(response);
  expect(
    HashMap.size(
      await subject.connection.runtime.runPromise(
        ReadSubscriptions.use((reads) => reads.snapshot),
      ),
    ),
  ).toBe(0);
  const stop = subject.registry.mount(atom);
  try {
    await started.promise;
    expect(subject.registry.get(atom)).toMatchObject({
      _tag: 'Success',
      value: response,
      waiting: true,
    });
    const updated = {
      ...response,
      entries: [{ name: 'new.ts', kind: 'file' }],
    };
    held.resolve(Response.json(updated));
    expect(
      await Effect.runPromise(
        AtomRegistry.getResult(subject.registry, atom, {
          suspendOnWaiting: true,
        }),
      ),
    ).toEqual(updated);
    expect(AsyncResult.isSuccess(subject.registry.get(atom))).toBe(true);
  } finally {
    held.resolve(Response.json(response));
    stop();
  }
});
it('rejects another worktree returned by the transport', async () => {
  const rejected = {
    ...response,
    worktreeId: '11111111111111111111111111111111',
  };
  const subject = fixture(() => Promise.resolve(Response.json(rejected)));
  await expect(
    readClientAtom(
      subject.registry,
      readDirectory({ connection: subject.connection, scope, path: 'src' }),
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
