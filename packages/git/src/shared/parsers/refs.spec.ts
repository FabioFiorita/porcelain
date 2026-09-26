import { describe, expect, it } from 'vitest';
import {
  parseHeadFile,
  parseStashList,
  parseSymbolicRef,
  shortBranchName,
} from './refs.ts';

describe('parseSymbolicRef', () => {
  it('reads the branch HEAD points at', () => {
    expect(
      parseSymbolicRef({
        exitCode: 0,
        stdout: Buffer.from('refs/heads/main\n'),
      }),
    ).toBe('refs/heads/main');
  });

  it('reports no branch when HEAD is detached', () => {
    expect(parseSymbolicRef({ exitCode: 1, stdout: Buffer.alloc(0) })).toBe(
      null,
    );
  });

  it('reports no branch when Git did not finish', () => {
    expect(
      parseSymbolicRef({ exitCode: null, stdout: Buffer.from('refs/heads/x') }),
    ).toBe(null);
  });
});

describe('shortBranchName', () => {
  it('drops the refs/heads/ prefix and keeps nested names', () => {
    expect(shortBranchName('refs/heads/feature/login')).toBe('feature/login');
  });

  it('leaves a ref outside refs/heads/ untouched', () => {
    expect(shortBranchName('refs/remotes/origin/main')).toBe(
      'refs/remotes/origin/main',
    );
  });
});

describe('parseHeadFile', () => {
  it('reads an attached HEAD', () => {
    expect(parseHeadFile('ref: refs/heads/main\n')).toEqual({
      kind: 'attached',
      ref: 'refs/heads/main',
    });
  });

  it('reads a detached HEAD', () => {
    expect(parseHeadFile('a009a75e6294ff85720885cbc63f5ef03b85b3dd\n')).toEqual(
      { kind: 'detached' },
    );
  });

  it('rejects a symbolic ref outside refs/ and truncated content', () => {
    expect([
      parseHeadFile('ref: HEAD\n'),
      parseHeadFile('a009a75e62'),
      parseHeadFile(''),
    ]).toEqual([undefined, undefined, undefined]);
  });
});

describe('parseStashList', () => {
  it('reads each entry of the stash list format', () => {
    const output =
      'ccdc14ed14529c0ed2856043769bdf9297be052f\0stash@{0}\0On main: wip\n' +
      '6c1b860d27b09e27478a7e1cd13377dc66dc1dec\0stash@{1}\0WIP on main: 2a3a1e5 ahead\n';
    expect(parseStashList(output)).toEqual([
      {
        oid: 'ccdc14ed14529c0ed2856043769bdf9297be052f',
        selector: 'stash@{0}',
        message: 'On main: wip',
      },
      {
        oid: '6c1b860d27b09e27478a7e1cd13377dc66dc1dec',
        selector: 'stash@{1}',
        message: 'WIP on main: 2a3a1e5 ahead',
      },
    ]);
  });

  it('reads an empty stash as no entries', () => {
    expect(parseStashList('')).toEqual([]);
  });
});
