import { expect, it } from 'vitest';
import { archiveOptions, archiveSettings } from './archive.ts';
import { readPreferences } from '../store/saved-preferences.ts';
it('defaults all deletions on for existing installations and keeps explicit off settings', () => {
  expect(archiveOptions(readPreferences('{}'))).toEqual({
    deleteWorktree: true,
    deleteLocalBranch: true,
    deleteRemoteBranch: true,
  });
  expect(
    archiveOptions(readPreferences('{"archiveDeleteRemoteBranch":false}')),
  ).toEqual({
    deleteWorktree: true,
    deleteLocalBranch: true,
    deleteRemoteBranch: false,
  });
  expect(archiveSettings.map((setting) => setting.label)).toEqual([
    'Delete local worktree',
    'Delete local branch',
    'Delete remote branch',
  ]);
});
