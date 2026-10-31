import { EnvironmentLabelStore, HostNameReader } from '@porcelain/access/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { FixedHostNameReader } from '../../spec/fakes/fixed-host-name-reader.ts';
import { InMemoryEnvironmentLabelStore } from '../../spec/fakes/in-memory-environment-label-store.ts';
import { RenameEnvironmentService } from './rename-environment-service.ts';

function setup() {
  const store = new InMemoryEnvironmentLabelStore();
  return {
    store,
    rename: Effect.runSync(
      RenameEnvironmentService.pipe(
        Effect.provide(RenameEnvironmentService.layer),
        Effect.provideService(EnvironmentLabelStore, store),
        Effect.provideService(
          HostNameReader,
          new FixedHostNameReader('linux-desktop'),
        ),
      ),
    ),
  };
}

describe('RenameEnvironmentService', () => {
  it('keeps the chosen name and answers it', async () => {
    const { rename, store } = setup();
    expect(Effect.runSync(rename.execute({ name: 'Workstation' }))).toEqual({
      name: 'Workstation',
      custom: true,
    });
    expect(await Effect.runPromise(store.read())).toEqual({
      name: 'Workstation',
      icon: undefined,
    });
  });

  it('goes back to the host name when the name is cleared', async () => {
    const { rename, store } = setup();
    Effect.runSync(rename.execute({ name: 'Workstation' }));
    expect(Effect.runSync(rename.execute({ name: undefined }))).toEqual({
      name: 'linux-desktop',
      custom: false,
    });
    expect(await Effect.runPromise(store.read())).toEqual({
      name: undefined,
      icon: undefined,
    });
  });

  it('keeps the chosen icon and answers it with the new name', async () => {
    const { rename, store } = setup();
    Effect.runSync(store.save({ name: undefined, icon: 'laptop' }));
    expect(
      Effect.runSync(rename.execute({ name: 'Workstation' })),
    ).toStrictEqual({ name: 'Workstation', custom: true, icon: 'laptop' });
    expect(await Effect.runPromise(store.read())).toEqual({
      name: 'Workstation',
      icon: 'laptop',
    });
  });
});
