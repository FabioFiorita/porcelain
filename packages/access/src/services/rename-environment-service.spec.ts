import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { FixedHostNameReader } from '../../spec/fakes/fixed-host-name-reader.ts';
import { InMemoryEnvironmentNameStore } from '../../spec/fakes/in-memory-environment-name-store.ts';
import { RenameEnvironmentService } from './rename-environment-service.ts';

function setup() {
  const store = new InMemoryEnvironmentNameStore();
  return {
    store,
    rename: new RenameEnvironmentService(
      store,
      new FixedHostNameReader('linux-desktop'),
    ),
  };
}

describe('RenameEnvironmentService', () => {
  it('keeps the chosen name and answers it', () => {
    const { rename, store } = setup();
    expect(Effect.runSync(rename.execute({ name: 'Workstation' }))).toEqual({
      name: 'Workstation',
      custom: true,
    });
    expect(store.read()).toEqual({ name: 'Workstation' });
  });

  it('goes back to the host name when the name is cleared', () => {
    const { rename, store } = setup();
    Effect.runSync(rename.execute({ name: 'Workstation' }));
    expect(Effect.runSync(rename.execute({ name: undefined }))).toEqual({
      name: 'linux-desktop',
      custom: false,
    });
    expect(store.read()).toEqual({ name: undefined });
  });
});
