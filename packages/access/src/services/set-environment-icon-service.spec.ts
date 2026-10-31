import { EnvironmentLabelStore, HostNameReader } from '@porcelain/access/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { FixedHostNameReader } from '../../spec/fakes/fixed-host-name-reader.ts';
import { InMemoryEnvironmentLabelStore } from '../../spec/fakes/in-memory-environment-label-store.ts';
import { SetEnvironmentIconService } from './set-environment-icon-service.ts';

function setup() {
  const store = new InMemoryEnvironmentLabelStore();
  return {
    store,
    setIcon: Effect.runSync(
      SetEnvironmentIconService.pipe(
        Effect.provide(SetEnvironmentIconService.layer),
        Effect.provideService(EnvironmentLabelStore, store),
        Effect.provideService(
          HostNameReader,
          new FixedHostNameReader('linux-desktop'),
        ),
      ),
    ),
  };
}

describe('SetEnvironmentIconService', () => {
  it('keeps the chosen icon and answers it with the host name', async () => {
    const { setIcon, store } = setup();
    expect(Effect.runSync(setIcon.execute({ icon: 'server' }))).toStrictEqual({
      name: 'linux-desktop',
      custom: false,
      icon: 'server',
    });
    expect(await Effect.runPromise(store.read())).toEqual({
      name: undefined,
      icon: 'server',
    });
  });

  it('keeps the chosen name when the icon changes', async () => {
    const { setIcon, store } = setup();
    Effect.runSync(store.save({ name: 'Workstation', icon: undefined }));
    expect(Effect.runSync(setIcon.execute({ icon: 'cloud' }))).toStrictEqual({
      name: 'Workstation',
      custom: true,
      icon: 'cloud',
    });
    expect(await Effect.runPromise(store.read())).toEqual({
      name: 'Workstation',
      icon: 'cloud',
    });
  });

  it('goes back to no icon when the icon is cleared', async () => {
    const { setIcon, store } = setup();
    Effect.runSync(setIcon.execute({ icon: 'server' }));
    expect(Effect.runSync(setIcon.execute({ icon: undefined }))).toStrictEqual({
      name: 'linux-desktop',
      custom: false,
    });
    expect(await Effect.runPromise(store.read())).toEqual({
      name: undefined,
      icon: undefined,
    });
  });
});
