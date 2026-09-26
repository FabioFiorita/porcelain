import { describe, expect, it } from 'vitest';
import { validateRemoteProfile } from './validate-remote-profile.ts';

describe('validateRemoteProfile', () => {
  it('names a local repository without exposing its path', () => {
    expect(validateRemoteProfile('/srv/git/repo.git')).toBe('local repository');
  });

  it('accepts SSH remotes in both spellings', () => {
    expect([
      validateRemoteProfile('git@github.com:owner/repo.git'),
      validateRemoteProfile('ssh://git@github.com/owner/repo.git'),
    ]).toEqual([
      'git@github.com:owner/repo.git',
      'ssh://github.com/owner/repo.git',
    ]);
  });

  it('accepts HTTPS without credentials', () => {
    expect(validateRemoteProfile('https://github.com/owner/repo.git')).toBe(
      'https://github.com/owner/repo.git',
    );
  });

  it.each([
    'https://user@github.com/owner/repo.git',
    'https://user:secret@github.com/owner/repo.git',
    'ssh://git:secret@github.com/owner/repo.git',
    'https://github.com/owner/repo.git?token=1',
    'https://github.com/owner/repo.git#main',
    'git://github.com/owner/repo.git',
    'file:///srv/git/repo.git',
    'relative/repo.git',
  ])(
    'refuses the remote %j, which carries credentials, a query, a fragment or another protocol',
    (url) => {
      expect(() => validateRemoteProfile(url)).toThrow('Git action rejected');
    },
  );
});
