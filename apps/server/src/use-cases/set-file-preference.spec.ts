import { expect, it } from 'vitest';
import type { FilePreference } from '../models/file-preference.ts';
import type { FilePreferenceStore } from '../repositories/interfaces/file-preference-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { InvalidFilePreferenceError } from './errors/invalid-file-preference-error.ts';
import { ProjectNotFoundError } from './errors/project-not-found-error.ts';
import { ListFilePreferences } from './list-file-preferences.ts';
import { SetFilePreference } from './set-file-preference.ts';

it('requires known identity but permits unavailable inventory and missing paths without Git or filesystem access', () => {
  const inventory: InventoryStore = {
    read: () => ({
      environmentId: 'environment',
      projects: [
        {
          id: 'project',
          name: 'project',
          commonDirectory: '/absent/.git',
          repositoryIdentity: 'identity',
          available: false,
          worktrees: [
            {
              id: 'known',
              path: '/absent',
              metadataIdentity: null,
              main: true,
              branch: null,
              available: false,
            },
          ],
        },
      ],
    }),
    save: () => {
      throw new Error('Preferences must not change inventory');
    },
  };
  const rows: FilePreference[] = [];
  const preferences: FilePreferenceStore = {
    list: () => rows,
    set: (_id, change) => {
      rows.push({
        path: change.path,
        pinned: change.flag === 'pinned' && change.value,
        hidden: change.flag === 'hidden' && change.value,
      });
    },
  };
  const set = new SetFilePreference(inventory, preferences);
  const list = new ListFilePreferences(inventory, preferences);
  expect(() =>
    set.execute('unknown', { path: 'file', flag: 'pinned', value: true }),
  ).toThrow(ProjectNotFoundError);
  expect(() => list.execute('unknown')).toThrow(ProjectNotFoundError);
  expect(rows).toEqual([]);
  for (const path of [
    '',
    '/absolute',
    '../escape',
    'x/../y',
    './file',
    'x//y',
    '.git/config',
    'x/.GIT',
    'x\0y',
    'C:/file',
    'c:relative',
    'x'.repeat(4097),
    'a\\b',
  ]) {
    expect(() =>
      set.execute('project', { path, flag: 'hidden', value: true }),
    ).toThrow(InvalidFilePreferenceError);
  }
  expect(rows).toEqual([]);
  expect(
    set.execute('project', {
      path: 'absent/file.ts',
      flag: 'pinned',
      value: true,
    }),
  ).toEqual([{ path: 'absent/file.ts', pinned: true, hidden: false }]);
  for (const path of [
    'notes:today.txt',
    'folder/notes:today.txt',
    'x'.repeat(4096),
  ]) {
    expect(
      set.execute('project', { path, flag: 'pinned', value: true }),
    ).toContainEqual({ path, pinned: true, hidden: false });
  }
  expect(list.execute('project')).toEqual(rows);
});
