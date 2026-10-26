import { expect, it } from 'vitest';
import { archiveOptions, archiveSettings } from './archive.ts';
it('turns the computer’s archive settings into the deletions an archive plan asks for', () => {
  expect(
    archiveOptions({
      archiveDeleteWorktree: true,
      archiveDeleteLocalBranch: false,
      archiveDeleteRemoteBranch: true,
    }),
  ).toEqual({
    deleteWorktree: true,
    deleteLocalBranch: false,
    deleteRemoteBranch: true,
  });
  expect(archiveSettings.map((setting) => setting.label)).toEqual([
    'Delete local worktree',
    'Delete local branch',
    'Delete remote branch',
  ]);
});
