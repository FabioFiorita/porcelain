import { EnvironmentNameStore, HostNameReader } from '@porcelain/access/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { FixedHostNameReader } from '../../spec/fakes/fixed-host-name-reader.ts';
import { InMemoryEnvironmentNameStore } from '../../spec/fakes/in-memory-environment-name-store.ts';
import { RenameEnvironmentService } from './rename-environment-service.ts';

function setup() {
  const store = new InMemoryEnvironmentNameStore();
  return {
    store,
    rename: Effect.runSync(
      RenameEnvironmentService.pipe(
        Effect.provide(RenameEnvironmentService.layer),
        Effect.provideService(EnvironmentNameStore, store),
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
    });
  });

  it('goes back to the host name when the name is cleared', async () => {
    const { rename, store } = setup();
    Effect.runSync(rename.execute({ name: 'Workstation' }));
    expect(Effect.runSync(rename.execute({ name: undefined }))).toEqual({
      name: 'linux-desktop',
      custom: false,
    });
    expect(await Effect.runPromise(store.read())).toEqual({ name: undefined });
  });
});
