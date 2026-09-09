import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { FilePreferenceLimitError } from './errors/file-preference-limit-error.ts';
import { FilePreferenceRepository } from './file-preference-repository.ts';

it('bounds each project to 2000 paths while permitting retries, independent updates, and clearing to free capacity', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'porcelain-preference-limit-'),
  );
  const database = openDatabase(directory);
  try {
    const store = new FilePreferenceRepository(database.db);
    for (const index of Array.from({ length: 2000 }, (_, index) => index)) {
      store.set('one', { path: `file-${index}`, flag: 'pinned', value: true });
    }
    expect(() =>
      store.set('one', { path: 'overflow', flag: 'hidden', value: true }),
    ).toThrow(FilePreferenceLimitError);
    store.set('one', { path: 'file-0', flag: 'hidden', value: true });
    store.set('one', { path: 'file-0', flag: 'pinned', value: true });
    store.set('one', { path: 'absent', flag: 'hidden', value: false });
    store.set('one', { path: 'file-0', flag: 'pinned', value: false });
    expect(store.list('one')).toHaveLength(2000);
    expect(store.list('one')).toContainEqual({
      path: 'file-0',
      pinned: false,
      hidden: true,
    });
    expect(() =>
      store.set('one', { path: 'overflow', flag: 'pinned', value: true }),
    ).toThrow(FilePreferenceLimitError);
    store.set('one', { path: 'file-0', flag: 'hidden', value: false });
    store.set('one', { path: 'overflow', flag: 'hidden', value: true });
    expect(store.list('one')).toHaveLength(2000);
    expect(store.list('one')).toContainEqual({
      path: 'overflow',
      pinned: false,
      hidden: true,
    });
    store.set('two', { path: 'separate', flag: 'pinned', value: true });
    expect(store.list('two')).toEqual([
      { path: 'separate', pinned: true, hidden: false },
    ]);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
