import { Reactivity } from 'effect/reactivity';
import { expect, it } from 'vite-plus/test';
import {
  clientFixtures,
  idleClientAtoms,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import {
  readWalkthroughWriterSettings,
  recheckWalkthroughWriterSettings,
} from './walkthrough-writer.ts';

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

it('checks the catalog once and refreshes the default and both project views', async () => {
  const writer = {
    provider: 'claude',
    model: 'claude-opus-5-5',
    effort: 'high',
  };
  const requests: string[] = [];
  let available = false;
  const subject = create((path) => {
    requests.push(path);
    if (new URL(path, 'http://fixture').searchParams.get('refresh') === 'true')
      available = true;
    return Promise.resolve(
      Response.json({
        writer,
        models: available
          ? [
              {
                ...writer,
                label: 'Opus 5.5',
                efforts: ['high'],
                defaultEffort: 'high',
              },
            ]
          : [],
        availability: available ? 'ready' : 'missing-model',
      }),
    );
  });
  const defaults = readWalkthroughWriterSettings(subject.connection);
  const first = readWalkthroughWriterSettings(
    subject.connection,
    'first-project',
  );
  const second = readWalkthroughWriterSettings(
    subject.connection,
    'second-project',
  );
  const stops = [defaults, first, second].map((atom) =>
    subject.registry.mount(atom),
  );
  const statuses = async () =>
    (
      await Promise.all(
        [defaults, first, second].map((atom) =>
          readClientAtom(subject.registry, atom),
        ),
      )
    ).map((result) => result.availability);
  try {
    expect(await statuses()).toEqual([
      'missing-model',
      'missing-model',
      'missing-model',
    ]);
    const recheck = recheckWalkthroughWriterSettings(subject.connection);
    subject.registry.set(recheck, undefined);
    await readClientAtom(subject.registry, recheck);
    await idleClientAtoms(subject.registry);
    expect(await statuses()).toEqual(['ready', 'ready', 'ready']);
    expect(requests.filter((path) => path.includes('refresh=true'))).toEqual([
      '/api/walkthrough-settings?refresh=true',
    ]);
  } finally {
    stops.forEach((stop) => stop());
  }
});
