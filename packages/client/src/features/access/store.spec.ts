import { describe, expect, it } from 'vitest';
import { createAccessStore } from './store.ts';
import type { Remote } from '@porcelain/client/access/rules';

const first: Remote = {
  environmentId: 'first',
  name: 'First computer',
  address: 'http://first.local:4738',
  credential: 'first-credential',
  deviceId: 'first-device',
};
const second: Remote = {
  environmentId: 'second',
  name: 'Second computer',
  address: 'http://second.local:4738',
  credential: 'second-credential',
  deviceId: 'second-device',
};

describe('saved environments', () => {
  it('refuses a write before saved state has been read', async () => {
    const persisted: Remote[][] = [];
    const store = createAccessStore({
      read: () => Promise.resolve([first]),
      write: (remotes) => {
        persisted.push([...remotes]);
        return Promise.resolve();
      },
    });
    await expect(store.getState().save(second)).rejects.toThrow('read');
    expect(persisted).toEqual([]);
    await store.getState().load();
    expect(store.getState().remotes).toEqual([first]);
    expect(store.getState().status).toBe('ready');
  });

  it('persists a replacement before publishing it and preserves other environments', async () => {
    let saved = [first, second];
    const observed: Remote[][] = [];
    const store = createAccessStore({
      read: () => Promise.resolve(saved),
      write: (remotes) => {
        observed.push(store.getState().remotes);
        saved = [...remotes];
        return Promise.resolve();
      },
    });
    await store.getState().load();
    const replacement = { ...first, credential: 'new', deviceId: 'new-device' };
    await store.getState().save(replacement);
    expect(observed).toEqual([[first, second]]);
    expect(store.getState().remotes).toEqual([second, replacement]);
    const restored = createAccessStore({
      read: () => Promise.resolve(saved),
      write: () => Promise.resolve(),
    });
    await restored.getState().load();
    expect(restored.getState().remotes).toEqual([second, replacement]);
  });

  it('keeps the last read state and blocks further writes after persistence fails', async () => {
    let writes = 0;
    const store = createAccessStore({
      read: () => Promise.resolve([first]),
      write: () => {
        writes += 1;
        return Promise.reject(new Error('secure storage failed'));
      },
    });
    await store.getState().load();
    await expect(store.getState().save(second)).rejects.toThrow('updated');
    expect(store.getState().remotes).toEqual([first]);
    expect(store.getState().status).toBe('unreadable');
    await expect(store.getState().forget(first.environmentId)).rejects.toThrow(
      'read',
    );
    expect(writes).toBe(1);
    await store.getState().load();
    expect(store.getState().status).toBe('ready');
  });

  it('does not overwrite unreadable saved state or expose storage internals', async () => {
    let writes = 0;
    const store = createAccessStore({
      read: () => Promise.reject(new Error('private storage detail')),
      write: () => {
        writes += 1;
        return Promise.resolve();
      },
    });
    await store.getState().load();
    expect(store.getState().status).toBe('unreadable');
    expect(store.getState().error).toBe(
      'Saved environments could not be read. Try reading them again.',
    );
    await expect(store.getState().save(second)).rejects.toThrow('read');
    expect(writes).toBe(0);
  });
});
