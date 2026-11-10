import { Reactivity } from 'effect/reactivity';
import { expect, it } from 'vitest';
import {
  clientFixtures,
  idleClientAtoms,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { readWalkthroughWriterSettings } from './walkthrough-writer.ts';

const create = clientFixtures();
it('refreshes the inherited writer when this computer publishes an inventory change', async () => {
  let writer = { provider: 'claude', model: 'claude-opus-5-5', effort: 'high' };
  let reads = 0;
  const subject = create(() => {
    reads++;
    return Promise.resolve(Response.json({ writer, models: [] }));
  });
  const atom = readWalkthroughWriterSettings(subject.connection);
  const stop = subject.registry.mount(atom);
  try {
    expect((await readClientAtom(subject.registry, atom)).writer).toEqual({
      provider: 'claude',
      model: 'claude-opus-5-5',
      effort: 'high',
    });
    writer = { provider: 'codex', model: 'gpt-5.5', effort: 'medium' };
    subject.connection.runtime.runSync(
      Reactivity.invalidate([
        queryKeys.inventory(subject.connection.environmentId),
      ]),
    );
    await idleClientAtoms(subject.registry);
    expect(reads).toBe(2);
    expect((await readClientAtom(subject.registry, atom)).writer).toEqual({
      provider: 'codex',
      model: 'gpt-5.5',
      effort: 'medium',
    });
  } finally {
    stop();
  }
});
