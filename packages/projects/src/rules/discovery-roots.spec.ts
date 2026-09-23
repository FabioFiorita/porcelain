import { describe, expect, it } from 'vitest';
import { discoveryRoots } from './discovery-roots.ts';

describe('discoveryRoots', () => {
  it('starts at the project home', () => {
    expect(discoveryRoots('/home/me/code', [])).toEqual(['/home/me/code']);
  });

  it('adds the folder that holds each registered main checkout', () => {
    expect(
      discoveryRoots('/home/me/code', [
        { commonDirectory: '/srv/work/api/.git' },
      ]),
    ).toEqual(['/home/me/code', '/srv/work']);
  });

  it('lists a shared parent folder once', () => {
    expect(
      discoveryRoots('/home/me/code', [
        { commonDirectory: '/home/me/code/api/.git' },
        { commonDirectory: '/home/me/code/web/.git' },
      ]),
    ).toEqual(['/home/me/code']);
  });

  it('never searches from the filesystem root', () => {
    expect(
      discoveryRoots('/home/me/code', [{ commonDirectory: '/api/.git' }]),
    ).toEqual(['/home/me/code']);
  });
});
