import { describe, expect, it } from 'vitest';
import { observedSides } from './observed-sides.ts';

describe('observedSides', () => {
  it('turns files, symlinks and submodule heads into sides', () => {
    const observed = observedSides(
      { files: ['a.md', 'link', 'fifo'], submodules: ['vendor/lib'] },
      new Map([
        ['a.md', { kind: 'file', digest: 'd'.repeat(64), stamp: 's1' }],
        ['link', { kind: 'symlink', target: 'a.md', stamp: 's2' }],
        ['fifo', { kind: 'other' }],
      ]),
      new Map([['vendor/lib', 'e'.repeat(40)]]),
    );
    expect(Object.fromEntries(observed.sides)).toEqual({
      'vendor/lib': { submodule: 'e'.repeat(40) },
      'a.md': { digest: 'd'.repeat(64) },
      link: { symlink: 'a.md' },
    });
  });

  it('stamps only the files and symlinks it could read', () => {
    const observed = observedSides(
      { files: ['a.md', 'link', 'fifo', 'missing.md'], submodules: [] },
      new Map([
        ['a.md', { kind: 'file', digest: 'd'.repeat(64), stamp: 's1' }],
        ['link', { kind: 'symlink', target: 'a.md', stamp: 's2' }],
        ['fifo', { kind: 'other' }],
      ]),
      new Map(),
    );
    expect(Object.fromEntries(observed.stamps)).toEqual({
      'a.md': 's1',
      link: 's2',
    });
  });

  it('leaves a submodule without a readable head unobserved', () => {
    const observed = observedSides(
      { files: [], submodules: ['vendor/lib'] },
      new Map(),
      new Map(),
    );
    expect(observed.sides.size).toBe(0);
  });

  it('leaves a file too large to digest without a side or a stamp', () => {
    const observed = observedSides(
      { files: ['big.bin'], submodules: [] },
      new Map([['big.bin', { kind: 'too-large' }]]),
      new Map(),
    );
    expect([observed.sides.size, observed.stamps.size]).toEqual([0, 0]);
  });
});
