import { describe, expect, it } from 'vitest';
import { parentFolder } from './parent-folder.ts';

describe('parentFolder', () => {
  it('answers the folder that holds the path', () => {
    expect(parentFolder('/srv/api/.git')).toBe('/srv/api');
  });

  it('ignores trailing slashes', () => {
    expect(parentFolder('/srv/api//')).toBe('/srv');
  });

  it('answers the filesystem root for a folder at the top', () => {
    expect(parentFolder('/srv')).toBe('/');
  });

  it('answers the filesystem root for the root itself', () => {
    expect(parentFolder('/')).toBe('/');
  });

  it('answers the current folder for a relative name without a parent', () => {
    expect(parentFolder('api')).toBe('.');
  });
});
