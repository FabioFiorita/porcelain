import { PlatformError } from 'effect';
import { describe, expect, it } from 'vitest';
import { GitCommandError } from './git-command-error.ts';
import { GitFilesystemError } from './git-filesystem-error.ts';
import { UnsupportedRepositoryError } from './unsupported-repository-error.ts';
import { UnsupportedFilesystemIdentityError } from './unsupported-filesystem-identity-error.ts';
import { RepositoryIdentityMismatchError } from './repository-identity-mismatch-error.ts';
import { repositoryUnavailableReason } from './repository-unavailable-reason.ts';
import { isRepositoryUnavailable } from './is-repository-unavailable.ts';

it.each([0, 128])(
  'classifies an exited Git command (%s) as repository-unavailable',
  (exitCode) => {
    const error = new GitCommandError({
      checkout: '/repo',
      args: [],
      exitCode,
      stderr: '',
    });
    expect(repositoryUnavailableReason(error)).toBe('git-failed');
    expect(isRepositoryUnavailable(error)).toBe(true);
  },
);

it.each(['EMFILE', 'EAGAIN', 'ENOENT', 'EACCES'])(
  'keeps a Git spawn failure (%s) outside repository-unavailable',
  (code) => {
    const error = new GitCommandError({
      checkout: '/repo',
      args: [],
      exitCode: undefined,
      stderr: '',
      cause: Object.assign(new Error('spawn failed'), { code }),
    });
    expect(repositoryUnavailableReason(error)).toBeUndefined();
    expect(isRepositoryUnavailable(error)).toBe(false);
  },
);

describe.each(['native', 'wrapped'] as const)(
  'filesystem failures (%s)',
  (wrapper) => {
    it.each([
      ['ENOENT', 'missing'],
      ['ENOTDIR', 'missing'],
      ['EACCES', 'permission'],
      ['EPERM', 'permission'],
      ['EMFILE', undefined],
      ['EAGAIN', undefined],
    ] as const)('classifies errno %s as %s', (code, reason) => {
      const error = Object.assign(new Error('filesystem failed'), { code });
      const failure =
        wrapper === 'wrapped'
          ? new GitFilesystemError({ cause: error })
          : error;
      expect(repositoryUnavailableReason(failure)).toBe(reason);
      expect(isRepositoryUnavailable(failure)).toBe(reason !== undefined);
    });
  },
);

it.each([
  new UnsupportedRepositoryError({}),
  new UnsupportedFilesystemIdentityError({}),
  new RepositoryIdentityMismatchError({}),
])('preserves unavailable semantics for $_tag', (error) => {
  expect(repositoryUnavailableReason(error)).toBe('git-failed');
  expect(isRepositoryUnavailable(error)).toBe(true);
});

it.each([
  ['NotFound', 'missing'],
  ['PermissionDenied', 'permission'],
  ['Unknown', undefined],
] as const)('classifies platform %s as %s', (tag, reason) => {
  const error = PlatformError.systemError({
    _tag: tag,
    module: 'FileSystem',
    method: 'stat',
  });
  expect(repositoryUnavailableReason(error)).toBe(reason);
  expect(isRepositoryUnavailable(error)).toBe(reason !== undefined);
});
