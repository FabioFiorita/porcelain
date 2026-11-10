import { expect, it } from 'vitest';
import { networkActionBlocker } from './network-availability.ts';
import type { GitActionStatus } from './status.ts';

const status: GitActionStatus = {
  statusToken: 'seen',
  changes: [],
  branch: { name: 'main', upstream: 'origin/main', ahead: 0, behind: 1 },
};

it('allows Fetch while settings load but blocks Pull with the settings reason', () => {
  expect(
    networkActionBlocker(
      'fetch',
      status,
      'Reading Reviews & Git settings for this computer…',
    ),
  ).toBeNull();
  expect(
    networkActionBlocker(
      'pull',
      status,
      'Reading Reviews & Git settings for this computer…',
    ),
  ).toBe('Reading Reviews & Git settings for this computer…');
  expect(networkActionBlocker('pull', status, 'Computer offline')).toBe(
    'Computer offline',
  );
});

it('preserves upstream and worktree blockers with default pull settings', () => {
  expect(networkActionBlocker('pull', status, undefined)).toBeNull();
  expect(
    networkActionBlocker(
      'pull',
      {
        ...status,
        branch: {
          ...status.branch,
          name: 'main',
          upstream: undefined,
          ahead: 0,
          behind: 0,
        },
      },
      undefined,
    ),
  ).toBe('No upstream branch to pull from.');
  expect(
    networkActionBlocker(
      'fetch',
      { ...status, inProgress: 'rebase' },
      undefined,
    ),
  ).toBe('Continue or abort the rebase in a terminal.');
  expect(
    networkActionBlocker(
      'pull',
      { ...status, changes: [{ scope: 'untracked', path: 'local.txt' }] },
      undefined,
    ),
  ).toBe('Commit or stash local changes before pulling.');
});
