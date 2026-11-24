import { expect, it } from 'vite-plus/test';
import { queryObjects } from 'node:v8';
import { Atom, AtomRegistry, AsyncResult } from 'effect/reactivity';
import { retainRead } from '../src/shared/api/worktree-read.ts';
import { idleClientAtoms } from './kit/client-fixture.ts';

it('retains an inactive query identity while its confirmed answer is cached', async () => {
  class Reading {
    text = 'confirmed';
  }
  let answer: AsyncResult.AsyncResult<Reading> = AsyncResult.success(
    new Reading(),
  );
  const family = Atom.family((_: string) =>
    retainRead(Atom.make(() => answer).pipe(Atom.setIdleTTL(0))),
  );
  const registry = AtomRegistry.make();
  const visit = () => {
    const read = family('folder');
    const stop = registry.mount(read);
    expect(registry.get(read)).toMatchObject({ value: { text: 'confirmed' } });
    stop();
  };
  try {
    visit();
    answer = AsyncResult.initial(true);
    await idleClientAtoms(registry);
    queryObjects(Reading);
    expect(registry.get(family('folder'))).toMatchObject({
      _tag: 'Success',
      value: { text: 'confirmed' },
      waiting: true,
    });
  } finally {
    registry.dispose();
  }
});
