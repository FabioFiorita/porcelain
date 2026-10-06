import { afterEach, expect, it } from 'vitest';
import { Layer, Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const owned: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of owned) await close();
  owned.length = 0;
});
function fixture(transport: Transport, cacheIdentity?: readonly string[]) {
  const lifetime = createWorktreeConnection(
    {
      environmentId: 'environment',
      transport,
      timeoutMs: 10_000,
      ...(cacheIdentity ? { cacheIdentity } : {}),
    },
    undefined,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  owned.push(async () => {
    registry.dispose();
    await lifetime.close();
  });
  return { ...lifetime, registry };
}
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
