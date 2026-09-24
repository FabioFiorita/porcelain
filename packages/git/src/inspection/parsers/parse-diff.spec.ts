import { describe, expect, it } from 'vitest';
import { fixture } from '../../../spec/fixtures/fixture.ts';
import { diffKey, parseDiff } from './parse-diff.ts';

const worktree = fixture('diff/worktree.txt');
const printed = worktree.toString('utf8');

function patchOf(from: string, to?: string): string {
  const start = printed.indexOf(`diff --git a/${from} `);
  return printed.slice(
    start,
    to === undefined ? undefined : printed.indexOf(`diff --git a/${to} `),
  );
}

describe('parseDiff', () => {
  it('pairs each described file with its patch', () => {
    expect(Object.fromEntries(parseDiff(worktree))).toEqual({
      'b.txt': { kind: 'text', patch: patchOf('b.txt', 'c.txt') },
      'c.txt': { kind: 'metadata-only', patch: patchOf('c.txt', 'link') },
      link: { kind: 'text', patch: patchOf('link', 'logo.png') },
      'logo.png': { kind: 'binary' },
    });
  });

  it('gives a type change both of the patches Git prints for it', () => {
    const link = parseDiff(worktree).get('link');
    expect(link?.kind === 'text' ? link.patch : '').toMatch(
      /deleted file mode 120000[\s\S]*new file mode 100644/u,
    );
  });

  it('keys a rename by both of its paths', () => {
    expect([...parseDiff(fixture('diff/staged-rename.txt')).keys()]).toEqual([
      diffKey(['b.txt', 'renamed.txt']),
    ]);
  });

  it('omits a patch that is not UTF-8 instead of mangling it', () => {
    expect(parseDiff(fixture('diff/latin1.txt')).get('latin1.txt')).toEqual({
      kind: 'omitted',
      reason: 'unsupported-encoding',
    });
  });

  it('omits a single patch larger than one megabyte', () => {
    const entry = printed.slice(0, printed.indexOf(':', 1));
    const big = `${patchOf('b.txt', 'c.txt')}${'+x\n'.repeat(400_000)}`;
    expect(parseDiff(Buffer.from(`${entry}\0${big}`)).get('b.txt')).toEqual({
      kind: 'omitted',
      reason: 'size-limit',
    });
  });

  it('rejects output that describes more files than it prints', () => {
    expect(() => parseDiff(fixture('diff/worktree-truncated.txt'))).toThrow(
      'Invalid Git diff output',
    );
  });

  it('rejects output that prints more files than it describes', () => {
    expect(() =>
      parseDiff(fixture('diff/worktree-malformed-hand-edited.txt')),
    ).toThrow('Invalid Git diff output');
  });
});
