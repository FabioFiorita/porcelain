import { describe, expect, it } from 'vitest';
import { deriveProjectName } from './derive-project-name.ts';

describe('deriveProjectName', () => {
  it('names the project after the repository in an HTTPS origin', () => {
    expect(
      deriveProjectName('https://github.com/acme/porcelain.git', '/home/me/x'),
    ).toBe('porcelain');
  });

  it('reads the repository from an SCP-like SSH origin', () => {
    expect(
      deriveProjectName('git@github.com:acme/widgets.git', '/home/me/x'),
    ).toBe('widgets');
  });

  it('ignores trailing slashes and surrounding whitespace in the origin', () => {
    expect(
      deriveProjectName('  https://example.com/team/tools/  ', '/home/me/x'),
    ).toBe('tools');
  });

  it('falls back to the main checkout folder without an origin', () => {
    expect(deriveProjectName(undefined, '/home/me/notes/')).toBe('notes');
  });

  it('falls back to the folder when the origin has no repository path', () => {
    expect(deriveProjectName('https://example.com', '/srv/app')).toBe('app');
  });

  it('falls back to the folder when the origin name has no letters or digits', () => {
    expect(
      deriveProjectName('https://example.com/team/-.git', '/srv/app'),
    ).toBe('app');
  });

  it('accepts a local path origin', () => {
    expect(deriveProjectName('/mnt/mirrors/library.git', '/srv/app')).toBe(
      'library',
    );
  });
});
